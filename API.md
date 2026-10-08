# GhostBox API

GhostBox exposes a REST API for session management, inbox operations, and message retrieval. All endpoints live under `/api/`.

**Base URL:** `https://YOUR_DOMAIN/api/`

---

## Authentication

GhostBox supports two complementary authentication mechanisms:

### 1. Anonymous Session Isolation
- **Header:** `x-session-id` (UUID v4)
- Call `GET /api/session` to obtain or renew a `sessionId`.
- Pass `x-session-id` on all inbox and message endpoints.
- Inboxes created in Session A cannot be seen, read, or deleted by Session B.

### 2. Optional Master Credentials Protection
When `AUTH_PASSCODE` (and optionally `AUTH_USERNAME`) is configured in Worker environment variables:
- Sensitive endpoints (`/api/session`, `/api/inboxes`, `/api/inboxes/*`) require valid master credentials.
- Clients can send credentials via HTTP request headers:
  - `x-auth-passcode`: The configured passcode.
  - `x-auth-username`: The configured username (if username check is enabled).
- Alternatively, clients can authenticate through `POST /api/verify-passcode`.

---

## Endpoints

### GET `/api/config`

Returns public application configuration and capability metadata.

**Headers:** None

**Response** `200 OK`

```json
{
  "appName": "GhostBox",
  "mailDomain": "example.com",
  "mailDomains": ["example.com", "another-domain.my.id"],
  "webHost": "ghostbox.example.com",
  "maxInboxesPerSession": 15,
  "autoRefreshIntervalMs": 15000,
  "authRequired": true,
  "usernameRequired": true
}
```

| Field | Type | Description |
|---|---|---|
| `appName` | string | Application display name |
| `mailDomain` | string | Primary mail domain |
| `mailDomains` | string[] | List of all configured inbound mail domains |
| `webHost` | string | Frontend web hostname |
| `maxInboxesPerSession` | number | Maximum inboxes allowed per active session |
| `autoRefreshIntervalMs` | number | Auto-refresh interval in milliseconds (default: 15000) |
| `authRequired` | boolean | True if master passcode protection is active |
| `usernameRequired` | boolean | True if username is also required alongside passcode |

---

### POST `/api/verify-passcode`

Validates user-provided master credentials prior to unlocking session access.

**Headers:** `Content-Type: application/json`

**Request Body**

```json
{
  "username": "admin",
  "passcode": "YourMasterPasscode"
}
```

**Response** `200 OK`

```json
{
  "valid": true,
  "authRequired": true
}
```

**Errors**

| Status | Message | Meaning |
|---|---|---|
| `400` | `Invalid JSON body` | Malformed request payload |
| `401` | `Invalid username or passcode` | Credentials do not match Worker configuration |

---

### GET `/api/session`

Creates or verifies an anonymous browser session. If a valid `x-session-id` header is passed, the same ID is returned; otherwise, a fresh UUID v4 is generated.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | No | Existing session ID (UUID v4). Omit to generate a new session. |
| `x-auth-passcode` | Conditional | Required if `authRequired` is true |
| `x-auth-username` | Conditional | Required if `usernameRequired` is true |

**Response** `200 OK`

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Usage**

```bash
# Create a new session
curl -s https://YOUR_DOMAIN/api/session

# Reuse an existing session
curl -s https://YOUR_DOMAIN/api/session \
  -H "x-session-id: 550e8400-e29b-41d4-a716-446655440000"
```

---

### GET `/api/inboxes`

Lists all active inboxes linked to your current session.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | **Yes** | Session ID from `/api/session` |
| `x-auth-passcode` | Conditional | Required if `authRequired` is true |
| `x-auth-username` | Conditional | Required if `usernameRequired` is true |

**Response** `200 OK`

```json
[
  {
    "address": "randomuser@example.com",
    "created_at": "2026-10-08T10:00:00.000Z"
  }
]
```

---

### POST `/api/inboxes`

Creates a new disposable email address. If `localPart` is omitted, an authentic, random address is generated automatically.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | **Yes** | Session ID |
| `Content-Type` | **Yes** | `application/json` |

**Request Body**

```json
{
  "localPart": "myinbox",
  "domain": "example.com"
}
```

Both fields are optional. Pass `{}` to create a random inbox.

**Response** `201 Created`

```json
{
  "address": "myinbox@example.com",
  "created_at": "2026-10-08T10:00:00.000Z"
}
```

**Errors**

| Status | Message | Meaning |
|---|---|---|
| `400` | `Reserved localPart '...' is not allowed` | System reserved name (`admin`, `support`, etc.) |
| `400` | `Invalid localPart. Must be 1-32 alphanumeric characters...` | Formatting validation failure |
| `400` | `Invalid domain: ... Allowed: ...` | Requested domain is not in configured domain whitelist |
| `409` | `Address already registered by another session` | Anti-hijacking collision: address owned by another user |
| `429` | `Session inbox limit reached (maximum X inboxes per session)...` | Quota reached |

---

### DELETE `/api/inboxes/:address`

Deletes an inbox from your session. Deleting the inbox cascades to remove all associated messages from the database.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | **Yes** | Session ID |

**Response** `200 OK`

```json
{ "ok": true }
```

---

### GET `/api/inboxes/:address/messages`

Retrieves incoming messages for an inbox owned by the session.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | **Yes** | Session ID |

**Query Parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 50 | Number of messages to return (max 100) |
| `cursor` | string | none | Timestamp or ID pagination cursor |

**Response** `200 OK`

```json
[
  {
    "id": "msg_1791448465160_ccbe31ea",
    "message_id": "<CABcd...@mail.gmail.com>",
    "inbox_address": "target@example.com",
    "from_address": "sender@domain.com",
    "subject": "Verification Code",
    "body": "Your single use verification code is 123456",
    "received_at": "2026-10-08T09:27:00.000Z"
  }
]
```

---

### DELETE `/api/inboxes/:address/messages/:id`

Permanently deletes a single message.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | **Yes** | Session ID |

**Response** `200 OK`

```json
{ "ok": true }
```

---

## Full End-to-End Flow Example

```bash
DOMAIN="ghostbox.example.com"

# 1. Obtain session
SESSION=$(curl -s https://$DOMAIN/api/session | jq -r '.sessionId')

# 2. Create random disposable address
INBOX=$(curl -s -X POST https://$DOMAIN/api/inboxes \
  -H "x-session-id: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.address')
echo "Active Inbox: $INBOX"

# 3. List active inboxes
curl -s https://$DOMAIN/api/inboxes -H "x-session-id: $SESSION" | jq '.'

# 4. Fetch incoming messages
ENCODED=$(echo -n "$INBOX" | jq -sRr '@uri')
curl -s "https://$DOMAIN/api/inboxes/$ENCODED/messages" \
  -H "x-session-id: $SESSION" | jq '.'

# 5. Delete inbox
curl -s -X DELETE "https://$DOMAIN/api/inboxes/$ENCODED" \
  -H "x-session-id: $SESSION"
```

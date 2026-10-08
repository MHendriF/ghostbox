# GhostBox — Disposable Temp Mail on Cloudflare Workers

GhostBox is a modern, high-performance **disposable temporary email service** built entirely on the **Cloudflare Workers** ecosystem — requiring zero dedicated servers, zero Postfix daemons, and running 100% within Cloudflare's generous free tier ($0/month).

It leverages Cloudflare Email Workers for native inbound SMTP processing, Cloudflare D1 (serverless SQLite) for isolated storage, Cron Triggers for automated message purging, and a **Svelte 5 Runes SPA** bundled with Vite served globally from Cloudflare Edge Assets.

> **Official Repository**: [github.com/MHendriF/ghostbox](https://github.com/MHendriF/ghostbox)  

---

## Table of Contents
1. [Architecture & How It Works](#architecture--how-it-works)
2. [Key Features & Security Hardening](#key-features--security-hardening)
3. [System Requirements](#system-requirements)
4. [Step-by-Step Deployment Guide](#step-by-step-deployment-guide)
   - [Step 1: Clone Repository & Install Dependencies](#step-1-clone-repository--install-dependencies)
   - [Step 2: Cloudflare CLI (Wrangler) Authentication](#step-2-cloudflare-cli-wrangler-authentication)
   - [Step 3: Create Cloudflare D1 Database](#step-3-create-cloudflare-d1-database)
   - [Step 4: Configure wrangler.toml](#step-4-configure-wranglertoml)
   - [Step 5: Apply Database Migrations](#step-5-apply-database-migrations)
   - [Step 6: Configure Cloudflare Email Routing](#step-6-configure-cloudflare-email-routing)
   - [Step 7: DNS Records & Domain Reputation Setup](#step-7-dns-records--domain-reputation-setup)
   - [Step 8: Build, Test, and Local Validation](#step-8-build-test-and-local-validation)
   - [Step 9: Deploy to Cloudflare Edge](#step-9-deploy-to-cloudflare-edge)
5. [Automated Retention & Cron Purging](#automated-retention--cron-purging)
6. [Project Structure](#project-structure)
7. [Command Cheat Sheet](#command-cheat-sheet)
8. [Troubleshooting](#troubleshooting)
9. [License](#license)

---

## Architecture & How It Works

```
[ Inbound Email Sender ]
         │ (SMTP)
         ▼
[ Cloudflare MX Records ]
         │
         ▼
[ Cloudflare Email Worker ] (src/email-handler.ts)
    ├── Domain Whitelist Verification
    ├── Raw Stream Payload Guard (Max 1 MB)
    ├── RFC 5322 Body & Subject Truncation Guard
    ├── HTML-First Parsing (Preserves rich email markup)
    ├── Message-ID Deduplication (INSERT OR IGNORE)
    ├── Async Telegram Notification (Supergroup Forum Topic Routing)
    └── Store Message in Cloudflare D1 (SQLite)
         │
         ▼
[ Cloudflare D1 Database ] ◄── [ Cron Triggers: Hourly Purge >24h ] (src/index.ts)
         │
         ▼
[ Hono REST API & Edge Assets ] (src/api/routes.ts & dist/)
    ├── Anonymous Session Isolation (UUID v4)
    ├── Optional Master Passcode / Username Authentication
    ├── Strict Security Headers (CSP, nosniff, frame-ancestors)
    └── Dynamic Svelte 5 SPA Frontend (Vite Bundle)
         │
         ▼
[ User Browser ]
    ├── Svelte 5 Runes Reactive UI ($state, $derived, $effect)
    ├── Dynamic Auto-Resizing Sandboxed Iframe (No-Scripts)
    ├── Plaintext Nested Email Reply Parser (Collapsible Quote Trees)
    └── Safe URL Linkification (XSS-Free Anchor Wrapping)
```

- **Serverless Edge Performance**: Deployed across Cloudflare's 300+ global edge locations.
- **Zero Cost**: Stays entirely within Cloudflare free limits (100k worker requests/day, 5M D1 reads/day).
- **Session Privacy**: Anonymous browser sessions isolate inboxes so users cannot view or modify other users' emails.

---

## Key Features & Security Hardening

| Feature / Security Vector | Implementation Details |
|---|---|
| **Svelte 5 Runes Architecture** | Rebuilt frontend with Svelte 5 fine-grained reactivity (`$state`, `$derived`, `$effect`) bundled with Vite for near-instant rendering. |
| **HTML-First Fidelity** | Ingestion pipeline prioritizes rich HTML multipart bodies over plaintext, preserving layouts, styles, and embedded imagery. |
| **Dynamic Sandboxed Iframe** | Rendered via `<iframe sandbox="allow-same-origin allow-popups">` with scripts strictly disabled (`allow-scripts` omitted) and dynamic auto-resizing via `scrollHeight` to prevent internal scrollbars. |
| **Nested Email Reply Folding** | Plaintext parser (`parseEmailThread`) detects attribution headers (`On ... wrote:`, `From: ...`) and quote levels (`>`, `>>`, `>>>`), grouping replies into a collapsible tree view (`··· Show quoted history`). |
| **Telegram Forum Topics** | Dispatches incoming email alerts to Telegram supergroups with topic thread support via `TELEGRAM_THREAD_ID` (`message_thread_id`). |
| **Master Passcode Protection** | Optional `AUTH_PASSCODE` and `AUTH_USERNAME` gate sensitive endpoints (`/api/session`, `/api/inboxes`) with timing-safe comparison (`timingSafeEqual`). |
| **Strict Security Headers** | Hardened CSP (`default-src 'self'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: DENY`. |
| **Anti-Hijacking** | Enforces creator-ownership. Inboxes created in an active session reject claims from other sessions (`409 Conflict`). |
| **Input Sanitization** | `localPart` validation rejects reserved system aliases (`admin`, `abuse`, `postmaster`, etc.) and enforces strict character limits. |
| **Quota Defense** | Caps active inboxes per session (default: 15) to prevent resource exhaustion (`429 Too Many Requests`). |
| **Message Deduplication** | Database unique constraint on `message_id` prevents duplicate insertions from mail server retries. |

---

## System Requirements

- **Cloudflare Account**: [Sign up for free](https://dash.cloudflare.com/sign-up).
- **Active Domain**: Domain with nameservers configured on Cloudflare.
- **Node.js**: `v20.x` or later recommended (`node -v`).
- **npm**: `v9.x` or later (`npm -v`).

---

## Step-by-Step Deployment Guide

### Step 1: Clone Repository & Install Dependencies

```bash
git clone https://github.com/MHendriF/ghostbox.git
cd ghostbox
npm install
```

### Step 2: Cloudflare CLI (Wrangler) Authentication

```bash
npx wrangler login
```

Verify your account authentication:
```bash
npx wrangler whoami
```

### Step 3: Create Cloudflare D1 Database

```bash
npx wrangler d1 create ghostbox-db
```

Output will provide your `database_id`:
```text
[[d1_databases]]
binding = "DB"
database_name = "ghostbox-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Step 4: Configure wrangler.toml

Open [`wrangler.toml`](file:///d:/Work/projects/ghostbox/wrangler.toml) and update the values with your domain and database ID:

```toml
name = "ghostbox"
main = "src/index.ts"
compatibility_date = "2025-10-01"
workers_dev = false

# ---- D1 Database ----
[[d1_databases]]
binding = "DB"
database_name = "ghostbox-db"
database_id = "YOUR_D1_DATABASE_ID"

# ---- Email Routing Worker ----
# Inbound emails are routed via Cloudflare Dashboard -> Email Routing -> Catch-all rule -> Send to Worker (ghostbox)

# ---- Custom Domain Route ----
[[routes]]
pattern = "ghostbox.YOURDOMAIN.com"
custom_domain = true

# ---- Environment Variables ----
[vars]
APP_NAME = "GhostBox"
MAIL_DOMAIN = "YOURDOMAIN.com"
WEB_HOST = "ghostbox.YOURDOMAIN.com"
RETENTION_HOURS = "24"
MAX_INBOXES_PER_SESSION = "15"
MAX_EMAIL_SIZE_BYTES = "1048576"
MAX_BODY_SIZE_BYTES = "524288"
AUTO_REFRESH_INTERVAL_MS = "15000"
DEFAULT_MESSAGES_LIMIT = "50"
MAX_MESSAGES_LIMIT = "100"

# Optional Master Credentials Protection (Leave empty for public mode)
AUTH_USERNAME = ""
AUTH_PASSCODE = ""

# Optional Telegram Notifications (100% Free)
TELEGRAM_BOT_TOKEN = ""
TELEGRAM_CHAT_ID = ""
TELEGRAM_THREAD_ID = ""

# ---- Static Assets (Vite Bundle) & Cron ----
[assets]
directory = "./dist"

[triggers]
crons = ["0 * * * *"]

[observability]
enabled = true
```

### Step 5: Apply Database Migrations

Apply the SQLite schema to your remote D1 database:

```bash
npm run db:migrate
```

Verify that the tables exist:
```bash
npx wrangler d1 execute ghostbox-db --remote --command="PRAGMA table_list;"
```

### Step 6: Configure Cloudflare Email Routing

1. In the **[Cloudflare Dashboard](https://dash.cloudflare.com/)**, select your domain.
2. Navigate to **Email Routing** in the left sidebar.
3. Enable Email Routing (Cloudflare will automatically install MX records).
4. Under **Routing Rules** $\rightarrow$ **Catch-all rule**:
   - Set **Action**: `Send to a Worker`.
   - Select Worker: `ghostbox`.
   - Set status toggle to **Active**.
   - Click **Save**.

### Step 7: DNS Records & Domain Reputation Setup

Verify your DNS records under **Cloudflare Dashboard → DNS → Records**:

#### 7a. Web UI Custom Domain
- **Type**: `CNAME`
- **Name**: `ghostbox`
- **Target**: `ghostbox.workers.dev` (or auto-assigned worker host)
- **Proxy Status**: Proxied (Orange cloud)

#### 7b. MX Records (Inbound Mail)
Cloudflare Email Routing provisions these automatically:
- `MX @ route1.mx.cloudflare.net (Priority: 81)`
- `MX @ route2.mx.cloudflare.net (Priority: 5)`
- `MX @ route3.mx.cloudflare.net (Priority: 25)`

#### 7c. SPF Record
Add a TXT record on your root domain:
- **Type**: `TXT`
- **Name**: `@`
- **Content**: `v=spf1 include:_spf.mx.cloudflare.net ~all`

#### 7d. DMARC Record
- **Type**: `TXT`
- **Name**: `_dmarc`
- **Content**: `v=DMARC1; p=quarantine; sp=quarantine; rua=mailto:abuse@YOURDOMAIN.com`

### Step 8: Build, Test, and Local Validation

Run security tests and compile the Svelte 5 frontend bundle:

```bash
# 1. Run security & unit test suite (19/19 tests)
npm test

# 2. Check TypeScript types
npm run typecheck

# 3. Build production Svelte 5 SPA bundle into ./dist
npm run build
```

### Step 9: Deploy to Cloudflare Edge

```bash
npm run deploy
```

---

## Automated Retention & Cron Purging

GhostBox includes an automated cron trigger to maintain database hygiene:
- **Schedule**: Executes hourly (`0 * * * *`).
- **Message Retention**: Deletes messages older than `RETENTION_HOURS` (default: 24 hours).
- **Orphan Cleanup**: Deletes inboxes with no messages that are not linked to any active session.
- **Manual Deletion**: Users can delete individual messages or entire inboxes instantly via the web UI.

---

## Project Structure

```
ghostbox/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI (Tests & Typecheck)
├── dist/                          # Production Vite build artifacts (Served by Edge Assets)
├── src/
│   ├── index.ts                   # Worker entrypoint: fetch(), email(), scheduled()
│   ├── email-handler.ts           # Email ingestion (PostalMime) + HTML priority + D1 insert
│   ├── api/
│   │   └── routes.ts              # Hono REST API router & auth middlewares
│   ├── db/
│   │   ├── schema.sql             # D1 SQLite schema with foreign keys & indexes
│   │   └── queries.ts             # Session & message queries
│   ├── utils/
│   │   ├── eml.ts                 # RFC 5322 .EML exporter
│   │   ├── telegram.ts            # Telegram notifications & topic routing
│   │   └── random-address.ts      # Random address generator
│   └── frontend/                  # Svelte 5 Runes frontend
│       ├── main.ts                # Frontend entrypoint
│       ├── App.svelte             # Root application component
│       ├── styles.css             # Glassmorphic dark mode styling
│       ├── types.ts               # Shared frontend TypeScript interfaces
│       ├── utils.ts               # Thread parser, HTML sanitizer, URL linkifier
│       └── components/
│           ├── Header.svelte          # Header branding & subtitle
│           ├── HeroCard.svelte        # Active address display & quick actions
│           ├── MessageCard.svelte     # Message card (iframe auto-resize & reply folding)
│           ├── MessagesPanel.svelte   # Search toolbar & message list
│           ├── NewInboxDrawer.svelte  # Custom address creation drawer
│           ├── AuthModal.svelte       # Master passcode unlock modal
│           └── Toast.svelte           # Floating toast notification stack
├── test/
│   └── security.test.js           # 19 automated unit & security test specifications
├── API.md                         # Complete REST API specification
├── SECURITY.md                    # Vulnerability reporting guidelines
├── package.json                   # Dependencies and npm scripts
├── tsconfig.json                  # TypeScript configuration (Worker)
├── tsconfig.web.json              # TypeScript configuration (Svelte frontend)
├── vite.config.ts                 # Vite bundler configuration
└── wrangler.toml                  # Cloudflare Workers, D1 & Assets configuration
```

---

## Command Cheat Sheet

| Command | Description |
|---|---|
| `npm run build` | Builds the Svelte 5 frontend with Vite into `./dist` |
| `npm run deploy` | Builds the frontend and deploys the Worker to Cloudflare Edge |
| `npm test` | Runs the Node.js test runner (`node --test test/security.test.js`) |
| `npm run typecheck` | Validates TypeScript types across backend and frontend |
| `npm run dev` | Runs the local development server |
| `npm run db:migrate` | Applies `src/db/schema.sql` to the remote Cloudflare D1 database |
| `npm run db:local` | Applies `src/db/schema.sql` to the local development database |
| `npx wrangler tail` | Streams live production Worker logs in real-time |

---

## Troubleshooting

### 1. `DNS_PROBE_FINISHED_NXDOMAIN`
- **Cause**: DNS propagation is in progress or custom domain route has not finished provisioning.
- **Solution**: Verify nameservers with `dig +short YOURDOMAIN.com NS`. Ensure Cloudflare proxy (orange cloud) is enabled.

### 2. Inbound Email Not Appearing
- **Cause A**: Catch-all rule in Cloudflare Email Routing is not directed to Worker `ghostbox`.
- **Cause B**: Email size exceeds `MAX_EMAIL_SIZE_BYTES` (1 MB limit).
- **Cause C**: Check live execution logs:
  ```bash
  npx wrangler tail --format pretty
  ```

### 3. Error `Address already registered by another session` (HTTP 409)
- **Cause**: Anti-Hijacking defense triggered. The requested address is already owned by another browser session.
- **Solution**: Choose another custom alias or generate a random inbox.

---

## License

This project is licensed under the [MIT License](LICENSE).  
Developed by [MHendriF](https://github.com/MHendriF).

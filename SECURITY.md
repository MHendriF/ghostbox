# Security Policy

## Supported Versions

GhostBox is a self-hosted disposable mail service. We support the latest release on the default branch.

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within GhostBox, please report it responsibly:

1. **Do not create a public GitHub issue.**
2. Send an email with details, reproduction steps, and proof of concept to the repository maintainer or open a private GitHub Security Advisory.
3. Include:
   - Nature of the vulnerability (e.g. XSS, authentication bypass, data leak)
   - Steps to reproduce
   - Potential impact
   - Any suggested remediations

## Security Architecture & Defenses

GhostBox implements several defense-in-depth measures:

- **XSS Prevention**: Email contents rendered through DOM `textContent` APIs. Untrusted HTML email bodies are isolated in an unprivileged sandboxed iframe (`sandbox="allow-popups"` with no script execution and no origin inheritance).
- **HTTP Security Headers**: Strict Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `frame-ancestors 'none'`, `form-action 'self'`, and `X-Frame-Options: DENY`.
- **Timing-Safe Authentication**: Master username and passcode validation uses constant-time string comparison (`timingSafeEqual`) to prevent side-channel timing attacks.
- **Strict Session Isolation**: Header `x-session-id` is strictly validated against UUID v4 format (`isValidUuid`) before query execution, rejecting malformed or malicious identifiers.
- **CRLF Injection Prevention**: Raw `.eml` download generation strictly strips carriage return and line feed characters from `From`, `To`, and `Subject` headers.
- **Telegram Webhook Clamping & Token Validation**: Outbound Telegram notifications enforce strict bot token regex validation and clamp message payloads to <= 4000 characters, stripping control characters to prevent API rejection.
- **Ingestion Controls**: Strict domain whitelist verification, payload raw size limits (1MB), and field truncation limits on inbound emails.

---
id: auth-jwt
name: JWT Authentication Done Right
category: backend
estTokens: 2900
---

JWTs are the most misused auth primitive. Follow this exactly.

## Token strategy: short access + rotating refresh

- Access token: 5–15 min lifetime, contains only `sub` (user id), `iat`, `exp`, maybe `scope`. Never put PII, roles-that-change, or secrets in it.
- Refresh token: 7–30 day lifetime, opaque random string (NOT a JWT), stored hashed (SHA-256) in the database with `user_id`, `expires_at`, `revoked_at`, device label.
- Access token in memory (JS variable) or `httpOnly` cookie. Refresh token in `httpOnly; Secure; SameSite=Lax` (or `Strict`) cookie. Never `localStorage` — XSS steals it silently.
- On refresh: validate opaque token → revoke the old one → issue a new pair (rotation). Reuse of a revoked refresh token = possible theft → revoke the whole token family and force re-login.

## Signing and verification

- Algorithm: `RS256` (asymmetric) for multi-service, `HS256` only when one service signs and verifies. Pin the algorithm server-side — never trust the `alg` header from the token (classic `alg: none` attack).
- Use a maintained library (`jose`, `jsonwebtoken`, `PyJWT`). Never hand-roll base64/HMAC.
- Verify: signature, `exp`, `iss`, `aud`. Reject tokens with missing `exp`. Allow small clock skew (≤60s) via `clockTolerance`.
- Key rotation: publish JWKS (`/.well-known/jwks.json`), keep old keys valid during overlap, rotate every 90 days or on incident.

```ts
import { jwtVerify, createRemoteJWKSet } from "jose";
const JWKS = createRemoteJWKSet(new URL("https://auth.example.com/.well-known/jwks.json"));
const { payload } = await jwtVerify(token, JWKS, { issuer: "https://auth.example.com", audience: "api" });
```

## Logout and revocation

- JWTs can't be "deleted" — that's the tradeoff. Mitigations: short access lifetime (the real fix), refresh-token revocation list in DB, and for instant lockout keep a `token_version`/`banned_at` on the user row checked on refresh (and on access if you can afford a cache lookup).
- Logout: revoke refresh token server-side AND clear cookies. "Logout" that only clears the client is theater.

## Passwords (the other half of auth)

- Hash with `argon2id` (or bcrypt cost ≥12). Never MD5/SHA-*/unsalted.
- Constant-time compare on verification. Rate-limit login attempts (see rate-limiting skill).
- Never log passwords, tokens, or hashes. Never return them in API responses. Never put tokens in URLs (they end up in logs).

## Session checks on every request

- Middleware order: parse cookie → verify access token → load user → attach to request context → authorize.
- Distinguish 401 (bad/missing token) from 403 (valid token, insufficient permission).
- Refresh endpoint: `POST /auth/refresh` reads the httpOnly cookie, rotates, sets new cookies, returns 200 with no body (or minimal user info — never tokens in JSON body if cookies are used).

## Don'ts

- Don't store JWTs in localStorage/sessionStorage. Don't accept `alg: none`. Don't put permissions that change frequently in the token — check them server-side. Don't make access tokens live for hours "for convenience". Don't roll your own crypto, ever.

## JWT vs server sessions: decide once

| | JWT (stateless) | Server session (stateful) |
|---|---|---|
| Revocation | Hard (needs denylist/version) | Trivial (delete row) |
| Scale | No lookup | Needs shared store (Redis) |
| Payload | Self-contained claims | Opaque id only |
| Best for | Microservices, mobile APIs, short-lived | Web apps, instant logout needs |

- Hybrid (recommended for web): opaque session id in httpOnly cookie + Redis, OR short JWT access + opaque rotating refresh as described above. Pure long-lived JWTs in localStorage is the worst of all worlds.

## Token theft response

- On detecting refresh-token reuse: revoke the entire token family, notify the user ("new sign-in detected"), require password re-entry. Log IP/device fingerprints on refresh for anomaly detection.
- Bind refresh tokens to a device fingerprint hash where feasible; mismatch → step-up authentication.

## MFA and step-up

- After password login, issue an intermediate `mfa_pending` token (5 min, single-use) — not a full session. Full tokens only after the second factor verifies.
- Step-up auth: for sensitive actions (payout, email change), require fresh authentication (`auth_time` claim < 10 min old) even with a valid session.

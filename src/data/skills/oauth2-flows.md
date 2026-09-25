---
id: oauth2-flows
name: OAuth 2.0 Flows Explained
category: backend
estTokens: 3000
---

Pick the right flow, implement it exactly. OAuth 2.0 is authorization delegation — not authentication (that's OpenID Connect on top).

## Flow selection (the only decision that matters)

| Client | Flow | Notes |
|---|---|---|
| Web app with backend | Authorization Code + PKCE | Backend holds client_secret, exchanges code server-side |
| SPA / mobile (public client) | Authorization Code + PKCE | No client_secret; PKCE prevents code interception |
| M2M / CLI / cron | Client Credentials | No user involved; scope tightly |
| User's own script | Device Authorization Flow | TV/CLI: user approves on another device |

- **Implicit flow is dead.** Never use it (tokens in URL fragments leak via history/logs).
- **Resource Owner Password Credentials is dead.** Never collect the user's third-party password.

## Authorization Code + PKCE (the standard flow)

```
1. Client: code_verifier = random(43-128 chars)
          code_challenge = BASE64URL(SHA256(code_verifier))
2. → GET /authorize?response_type=code&client_id=...&redirect_uri=...&scope=...&state=...&code_challenge=...&code_challenge_method=S256
3. User approves → 302 redirect_uri?code=...&state=...
4. Client verifies `state` matches (CSRF protection — generate per request, bind to session)
5. → POST /token { grant_type=authorization_code, code, redirect_uri, code_verifier, client_id (+ client_secret for confidential clients) }
6. ← { access_token, refresh_token, expires_in, token_type: "Bearer" }
```

- `redirect_uri` must be pre-registered and matched exactly — no wildcards, no open redirects.
- `state`: unguessable, single-use, tied to the user's session. Verify before exchanging the code.
- Authorization codes: single-use, 30–60s lifetime, bound to the client_id + redirect_uri + PKCE verifier.

## Client Credentials (M2M)

```
POST /token
Content-Type: application/x-www-form-urlencoded
grant_type=client_credentials&client_id=...&client_secret=...&scope=payments:read
```

- Authenticate with `client_secret_basic` (HTTP Basic) or `private_key_jwt` (mTLS-grade, preferred at scale).
- Scope narrowly per client. Short token lifetimes (minutes–1h). Rotate secrets; support two active secrets during rotation.

## Scopes and tokens

- Scopes are coarse permissions: `read:orders`, `write:orders`. Request minimum; users distrust broad consent screens.
- Access tokens: opaque or JWT — opaque is fine and revocable; JWT only if resource servers validate offline.
- Refresh tokens: rotate on use (see auth-jwt skill). Bind to client; revoke on logout, password change, or suspicious reuse.

## OpenID Connect (when you need identity)

- Add `scope=openid` → get an `id_token` (JWT with `sub`, `iss`, `aud`, `exp`). Validate it like any JWT (signature via JWKS, iss/aud/exp).
- `id_token` proves WHO the user is; `access_token` proves WHAT the client may do. Don't use one as the other.

## Provider integration checklist

- Use a maintained library (Auth.js/NextAuth, `openid-client`, Passport with the right strategy). Don't hand-roll the token exchange.
- Store tokens server-side, associated with your own session. Never expose provider refresh tokens to the browser.
- Handle: user denies consent (`error=access_denied` at redirect), token expiry (refresh), provider outage (fail closed with a clear message).

## Don'ts

- Don't use implicit or password flows. Don't skip `state` verification. Don't accept redirect_uris you didn't pre-register. Don't put tokens in URLs. Don't request `offline_access`/refresh unless you need background access — and explain why in the consent UX.

## PKCE code (client-side)

```ts
const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
const challenge = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
// store verifier in sessionStorage (single tab flow) or memory; send challenge in /authorize
```

- `S256` challenge method only — `plain` defeats the purpose. Verifier is single-use: delete it after the token exchange.

## Token storage matrix

| Client | Access token | Refresh token |
|---|---|---|
| Web app w/ backend | Server-side session/store | Server-side, httpOnly cookie to browser holds only session id |
| SPA (no backend) | Memory (JS variable) | httpOnly cookie (requires provider + API same-site setup) or not at all — re-auth |
| Mobile | OS secure storage (Keychain/Keystore) | OS secure storage |
| Server/CLI | Encrypted file / secret manager | Secret manager |

- Never localStorage. Never URL params. Memory-only SPAs accept re-login on refresh — that's a feature, not a bug.

## Consent and UX

- Show exactly what scopes you're requesting, in plain language, before redirecting to the provider.
- Support "disconnect" per provider: revoke tokens at the provider (`/revoke` endpoint) AND delete locally. A disconnect that only deletes locally leaves a live grant.

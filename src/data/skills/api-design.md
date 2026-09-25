---
id: api-design
name: REST API Design Rules
category: backend
estTokens: 3000
---

Design APIs a developer can use without reading docs twice. Apply these rules every time.

## Resources and URLs

- Nouns, not verbs. `POST /orders`, never `POST /createOrder`.
- Plural collection names: `/users`, `/users/{id}/orders`.
- Nest one level deep max: `/users/{id}/orders`. Deeper nesting becomes unmaintainable — flatten with query params (`GET /orders?userId=...`).
- Filtering, sorting, pagination via query params: `GET /orders?status=paid&sort=-createdAt&page=2&limit=20`.
- Kebab-case for multi-word resources: `/payment-intents`.

## Methods

- `GET` read (safe, idempotent). `POST` create or non-idempotent action. `PUT` full replace (idempotent). `PATCH` partial update. `DELETE` remove (idempotent).
- Custom actions are rare; when needed, use verb sub-resources: `POST /orders/{id}/cancel`, `POST /invoices/{id}/send`.
- `POST` for create returns `201` with the resource in the body and a `Location` header.

## Status codes (use the full range, precisely)

- `200` success, `201` created, `204` no content (DELETE success).
- `400` malformed request / validation failure. `401` missing or invalid auth. `403` authenticated but not allowed. `404` resource doesn't exist (also use instead of 403 when you don't want to reveal existence). `409` conflict (duplicate, version mismatch). `422` semantically invalid (valid JSON, business rule violated).
- `429` rate limited (include `Retry-After`). `500` server bug — log it, don't leak internals.
- `401` vs `403`: 401 = "who are you?", 403 = "I know who you are, and no."

## Request/response shape

- JSON everywhere. `Content-Type: application/json`.
- One envelope for errors, everywhere:

```json
{ "error": { "code": "ORDER_ALREADY_PAID", "message": "Order ord_123 is already paid.", "details": { "orderId": "ord_123" } } }
```

- Success responses: return the resource object directly (no `data` wrapper) unless pagination requires metadata.
- Pagination envelope:

```json
{ "items": [...], "page": 2, "limit": 20, "total": 184, "hasMore": true }
```

- Prefer cursor pagination (`?cursor=...&limit=20`) for large or real-time datasets; page offsets break under inserts.
- Timestamps in ISO-8601 UTC (`2026-09-25T10:00:00Z`). IDs as strings (opaque, e.g. `usr_...`), never expose sequential integers publicly.

## Versioning

- Version in the URL path: `/v1/orders`. Never version via custom headers alone — they're invisible and hard to test.
- Never break v1. Add fields freely; removing or renaming requires a new version.

## Idempotency

- Mutating `POST` endpoints that charge money or create records MUST accept `Idempotency-Key: <uuid>` header. Store the key + response for 24h; replay the stored response on retry instead of re-executing.
- Make `PUT`/`DELETE` naturally idempotent (repeating them is a no-op).

## Security and hygiene

- Validate and whitelist every input; reject unknown fields or strip them — pick one and be consistent.
- Set sensible limits: request body size (e.g. 1MB default), query result caps, timeouts.
- Return `405` with an `Allow` header for wrong methods on a valid path.
- Never expose stack traces, SQL, or internal hostnames in error responses.

## Don'ts

- Don't use `GET` with a body. Don't tunnel actions through `POST /api` with an `action` field.
- Don't return `200` with `{ "success": false }` — that's what status codes are for.
- Don't leak existence: unauthenticated requests to `/users/{id}` should 401/404, not 403-differently per user.

## Bulk operations

- Bulk endpoints: `POST /orders/bulk` accepting `{ "items": [...] }` with a max batch size (e.g. 100). Return per-item results: `{ "results": [{ "index": 0, "status": 201, "id": "ord_1" }, { "index": 1, "status": 422, "error": {...} }] }` and an overall `207 Multi-Status`.
- Never silently skip failures in a bulk call. Partial success must be explicit per item.

## Webhooks vs polling guidance

- Offer webhooks for state changes clients react to (order.paid, user.deleted). Offer polling (`GET` with `since` cursor) for clients that need reliable catch-up.
- Every webhook event type should have a corresponding `GET` endpoint so a missed event is recoverable.

## Documentation

- OpenAPI 3.x spec is mandatory, generated from code annotations where possible (not hand-maintained separately — it drifts).
- Every endpoint documents: auth required, params, request/response examples, error codes it can return, rate limit tier.
- Publish a changelog for the API. Additive changes get a minor note; breaking changes get a version bump + migration guide.

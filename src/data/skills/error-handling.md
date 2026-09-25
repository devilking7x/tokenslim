---
id: error-handling
name: Error Handling That Actually Helps
category: backend
estTokens: 2700
---

Errors are a user interface for developers and operators. Design them deliberately.

## Taxonomy: three kinds of errors

1. **Programmer errors** (bugs): null dereference, failed invariant. → Crash fast, log with stack, alert. Don't try to "handle" these — fix them.
2. **Operational errors** (expected): DB down, timeout, 3rd-party 500, invalid input. → Handle, retry, or return a clean error.
3. **User errors** (bad input): validation failures. → Return 4xx with field-level detail. Never 500.

- If you can't classify it, it's a programmer error until proven otherwise.

## Throwing and catching

- Throw typed errors, not strings: `throw new OrderNotFoundError(orderId)` — catch sites can discriminate, messages stay consistent.
- Custom error base class carrying `code`, `statusCode`, `isOperational`:

```ts
export class AppError extends Error {
  constructor(
    public code: string,          // "ORDER_NOT_FOUND" — stable, for clients
    message: string,
    public statusCode = 500,
    public isOperational = true,
  ) { super(message); this.name = this.constructor.name; }
}
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource.toUpperCase()}_NOT_FOUND`, `${resource} ${id} not found`, 404);
  }
}
```

- Catch at boundaries (request handler, job worker, CLI entry), not at every layer. Let errors propagate to the layer that can decide.
- Never swallow: empty `catch {}` is a bug factory. If you intentionally ignore, comment why: `catch { /* best-effort metric, failure is non-fatal */ }`.
- Re-throw with context, don't replace: `catch (e) { throw new AppError("DB_QUERY_FAILED", \`orders query failed: ${(e as Error).message}\`, 503); }` — or use `cause`: `throw new AppError(..., { cause: e })`.

## Async

- Every promise chain ends handled: top-level `await` in handlers, `.catch()` on fire-and-forget, `process.on("unhandledRejection")` as a last-resort crash-and-alert (don't resume blindly).
- `Promise.allSettled` when tasks are independent and partial failure is meaningful; inspect each result's status.

## API error responses

- Consistent envelope (see api-design): `{ "error": { "code", "message", "details?" } }`. `code` is stable across deploys; `message` is human-readable and safe to show.
- Validation errors: 400/422 with per-field details: `{ "error": { "code": "VALIDATION_FAILED", "details": { "fields": { "email": "must be a valid email" } } } }`.
- 5xx: generic message to the client ("Something went wrong, reference abc123"), full details in logs keyed by that reference id. Include the reference id in the response.

## Logging errors

- Log once, at the boundary: `{ level: "error", err, code, requestId, userId?, route }`. Logging at every layer = duplicate noise.
- Include: stack trace, error code, request/correlation id, relevant ids (user, order) — never passwords, tokens, or full PII payloads.
- Distinguish logged-and-handled (warn) from logged-and-crashing (error + alert).

## Retries

- Retry only idempotent operations or transient failures (network timeout, 429, 503). Never blindly retry non-idempotent writes.
- Exponential backoff with jitter: `delay = min(cap, base * 2^attempt + rand())`. Cap attempts (3–5), then fail loudly.

## Don'ts

- Don't throw strings or plain objects. Don't catch-and-ignore silently. Don't leak stack traces or SQL to clients. Don't use errors for control flow in hot paths (use return values for expected branches). Don't log and rethrow at multiple layers.

## Circuit breakers

- Wrap calls to flaky dependencies (third-party APIs, overloaded services): closed → open after N consecutive failures → half-open probe after cooldown → closed on success.
- While open: fail fast with a cached fallback or clean 503 — don't queue requests against a dead dependency.
- Libraries: `opossum` (Node), `pybreaker` (Python), resilience4j (Java). Configure: failure threshold, cooldown, half-open trial count.

## Timeouts everywhere

- Every outbound call gets a timeout: HTTP (5–10s default), DB queries (statement_timeout, e.g. 30s), DNS. No timeout = one slow dependency eventually exhausts your threads/connections.
- Timeout < upstream timeout < client timeout, with margin at each layer. A 30s client timeout with a 30s server timeout guarantees client-side failures.

## Structured logging of context

- Carry a request/correlation id through the whole call chain (header `X-Request-Id`, generate if absent). Every log line and error includes it — this turns "something failed" into a traceable story.
- In job workers, the job id plays the same role. Propagate, don't regenerate, ids across service boundaries.

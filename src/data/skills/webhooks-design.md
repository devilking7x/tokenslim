---
id: webhooks-design
name: Webhook Design and Handling
category: backend
estTokens: 2900
---

Webhooks are the contract between two systems that can't call each other synchronously. Design both sides.

## Sending webhooks (provider side)

### Payload shape

```json
{
  "id": "evt_9f3k2m1n",
  "type": "order.paid",
  "created": "2026-09-25T10:00:00Z",
  "api_version": "2026-01-01",
  "data": { "order": { "id": "ord_123", "total": 4999 } }
}
```

- Every event: unique `id` (idempotency), namespaced `type` (`resource.action`, past tense), timestamp, version, and the full resource snapshot in `data` (receivers shouldn't need a follow-up fetch).
- Never break payload shape within an `api_version`. Version the payload, not just the REST API.

### Delivery guarantees

- **At-least-once** with retries: immediate, then exponential backoff with jitter (e.g. 1m, 5m, 30m, 2h, 12h) for up to 24–72h. Then dead-letter + alert.
- Timeout per attempt: 10–30s. A slow receiver must not clog your workers.
- Order is best-effort: include `created` timestamps and sequence info so receivers can reconcile; don't promise strict ordering across event types.

### Signing (receivers must verify — make it possible)

- HMAC-SHA256 over the raw body with a per-endpoint secret. Send: `X-Signature: t=<unix_ts>,v1=<hex>`.
- Include the timestamp so receivers can reject replays (>5 min old = reject).
- Provide secret rotation: allow two active secrets per endpoint.

## Receiving webhooks (consumer side)

### The handler template

```ts
app.post("/webhooks/stripe", async (req, res) => {
  const sig = req.headers["x-signature"] as string;
  if (!verifySignature(req.rawBody, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send("bad signature");   // verify BEFORE parsing/acting
  }
  const event = JSON.parse(req.rawBody);
  if (await db.processedEvents.exists(event.id)) return res.status(200).send("dup");
  await jobQueue.add("webhook", event);             // ack fast, process async
  res.status(200).send("ok");
});
```

### Rules

1. **Verify signature first**, using the raw body bytes. Framework body-parsers that re-serialize JSON break signatures — use the raw buffer.
2. **Respond 200 fast** (< a few seconds), then process asynchronously via a queue. Slow handlers cause provider retries → duplicate processing storms.
3. **Idempotency**: record `event.id` in the DB (unique constraint) before processing. Retried deliveries are normal, not errors.
4. **Replay tolerance**: handlers must be safe to run twice (upserts, state-machine transitions that no-op when already applied).
5. Accept unknown event types gracefully (log + 200) so the provider can add types without breaking you.
6. Return non-2xx only for genuine failures you want retried. Never 500 on a duplicate.

### Security

- Signature verification is authentication — no signature, no processing. Compare with constant-time equality.
- Webhook endpoints need rate limiting too (they're unauthenticated-ish public URLs).
- Log event ids/types, never full payloads with PII.

## Operational

- Provider: dashboard showing delivery attempts, status codes, latency per endpoint; manual "resend" button.
- Consumer: alert on signature failures spike (secret misconfigured or attack) and on queue backlog.
- Version your handler: route by `api_version` if you consume multiple.

## Don'ts

- Don't process webhooks synchronously in the request. Don't trust the payload without signature verification. Don't use the parsed-then-restringified body for verification. Don't return 500 for duplicates. Don't assume ordering — design for out-of-order arrival.

## Endpoint provisioning UX (provider side)

- Let users register endpoints via API/dashboard: URL, subscribed event types, secret (auto-generate, show once), active/inactive toggle.
- Validate the URL at registration: require HTTPS (except localhost), send a `webhook.test` ping event, require the receiver to echo a challenge token before marking the endpoint active.
- Cap endpoints per account (e.g. 20) and event types per endpoint to prevent abuse.

## Schema evolution for events

- Additive changes only within a version: new fields, new event types. Never rename/remove fields or change types.
- When you must break: new `api_version`, dual-send both versions during a deprecation window (announce 90 days ahead), then retire.
- Include `api_version` in every payload so receivers can branch without guessing.

## Monitoring (both sides)

- Track: delivery success rate, p50/p99 endpoint latency, retry rate, signature-failure rate. Alert when success rate drops below 99% over 10 minutes.
- Keep 30 days of delivery logs (event id, endpoint, attempt, status code, latency) — debugging "we never got it" without logs is impossible.

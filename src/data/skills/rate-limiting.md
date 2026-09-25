---
id: rate-limiting
name: Rate Limiting Strategies
category: backend
estTokens: 2800
---

Rate limiting protects availability and cost. Implement at the edge/gateway, enforce per-identity.

## Algorithms (pick one deliberately)

| Algorithm | How | Best for |
|---|---|---|
| Token bucket | Tokens refill at fixed rate; each request costs 1; burst = bucket size | APIs with bursty-but-bounded traffic |
| Sliding window log | Store each request timestamp; count in last N sec | Precise limits, moderate traffic |
| Sliding window counter | Fixed windows + weighted previous window | High traffic, cheap, near-exact |
| Fixed window | Counter per window, resets on boundary | Simple; suffers boundary spikes (2x burst at edges) |

- Default choice: **token bucket** (allows natural bursts) or **sliding window counter** (cheap + smooth). Avoid pure fixed window on abuse-sensitive endpoints.

## What to key on

- Authenticated: `user_id` or API key — the real identity. Per-IP alone is wrong behind NAT/VPN (one IP = thousands of users) and trivially bypassed by attackers with many IPs.
- Unauthenticated: IP + endpoint, but treat as coarse abuse protection, not accounting.
- Tiered: stricter for expensive endpoints (`POST /reports`: 5/min) vs cheap reads (`GET /users/me`: 600/min).

## Redis implementation (sliding window counter via Lua — atomic)

```lua
-- KEYS[1]=key, ARGV[1]=window_ms, ARGV[2]=limit
local now = tonumber(ARGV[1] == "now" and redis.call("TIME")[1] * 1000 or ARGV[1])
```

Simpler robust pattern — token bucket with a single Lua script:

```lua
-- KEYS[1] = bucket key; ARGV = {capacity, refill_per_sec, now_ms}
local b = redis.call("HMGET", KEYS[1], "tokens", "ts")
local tokens = tonumber(b[1]) or tonumber(ARGV[1])
local ts = tonumber(b[2]) or tonumber(ARGV[3])
local elapsed = math.max(0, (tonumber(ARGV[3]) - ts) / 1000)
tokens = math.min(tonumber(ARGV[1]), tokens + elapsed * tonumber(ARGV[2]))
if tokens < 1 then
  redis.call("HMSET", KEYS[1], "tokens", tokens, "ts", ARGV[3])
  redis.call("PEXPIRE", KEYS[1], 60000)
  return 0
end
redis.call("HMSET", KEYS[1], "tokens", tokens - 1, "ts", ARGV[3])
redis.call("PEXPIRE", KEYS[1], 60000)
return 1
```

- Lua = atomic check-and-decrement. Never do GET/DECR in two round trips (race condition under load).

## HTTP contract

- Return `429 Too Many Requests` with `Retry-After: <seconds>`.
- Send informative headers on all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (unix timestamp).
- Error body follows your standard envelope: `{ "error": { "code": "RATE_LIMITED", ... } }`.

## Layering

1. **Edge/CDN/WAF** (Cloudflare, AWS WAF): coarse IP-based, absorbs DDoS before it reaches you.
2. **API gateway / middleware**: per-user/per-key token buckets — the main enforcement.
3. **Endpoint-specific**: login (5 attempts/min/IP+username → then CAPTCHA/lockout), password reset, signup, webhooks ingress.
4. **Downstream protection**: limit concurrency to slow dependencies (DB pool, third-party APIs) with bulkheads/queues.

## Login-specific

- Count failures per (username + IP). After threshold: exponential backoff or temporary lockout + notify the user.
- Never reveal "user exists" via different limit behavior. Constant-time, identical responses.

## Don'ts

- Don't rate-limit only by IP for authenticated APIs. Don't return 403 for rate limits (it's 429). Don't implement check-then-act without atomicity. Don't set one global limit — expensive endpoints need their own. Don't let the limiter fail open on Redis outage for auth endpoints (fail closed or degrade deliberately, and alert).

## Distributed edge cases

- Clock skew: use Redis server time (`TIME`) inside Lua scripts, not client timestamps — clients disagree by seconds.
- Failover: during Redis failover, allow a small grace (fail-open with in-memory fallback for non-critical endpoints, fail-closed for auth/payment). Decide per endpoint, document it, alert on it.
- Multi-region: run the limiter near the user (edge KV with eventual consistency) for coarse limits; authoritative per-user limits in the region owning the user.

## Communicating limits to users

- On 429, the error message should say what to do: "Too many requests — retry in 42 seconds." Include the `Retry-After` value in the body too, not just the header.
- Expose current quota in the product UI for paid tiers ("4,200 / 10,000 API calls used") — support tickets drop measurably.
- Never silently shape traffic without headers; clients can't back off intelligently if they can't see the limit.

## Testing your limiter

- Load-test the limiter itself: it must sustain 10x your peak without becoming the bottleneck (Lua scripts are ~0.1ms; the network round trip dominates).
- Test the boundary: exactly at limit → allowed; limit+1 → 429. Test window rollover. Test with `Retry-After` honored by a well-behaved client.

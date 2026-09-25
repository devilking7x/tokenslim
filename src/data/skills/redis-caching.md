---
id: redis-caching
name: Redis Caching Patterns
category: database
estTokens: 2900
---

Redis is fast; misused Redis is a second source of truth. These patterns keep it correct.

## Core patterns

### Cache-aside (lazy loading) — the default

```ts
async function getUser(id: string): Promise<User> {
  const key = `user:${id}`;
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);
  const user = await db.users.findById(id);      // miss → load
  if (user) await redis.set(key, JSON.stringify(user), "EX", 300);
  return user;
}
```

- Always set a TTL. No TTL = unbounded growth = eventual OOM. Default 5–15 min for entity caches.
- Invalidate on write: update DB → `DEL user:{id}`. Accept brief staleness or use write-through for strong consistency needs.

### Write-through

- Write to cache and DB together (cache first or DB first, then the other, in one code path). Reads never miss. Use when read-after-write consistency matters and write volume is moderate.

### Read-through / write-behind

- Let the cache library own the loader. Write-behind (async DB write) risks data loss on crash — only for counters/analytics where loss is tolerable.

## Data structures (use the right one)

- Strings: simple KV, counters (`INCR`), rate limit buckets, locks (`SET key val NX PX 30000`).
- Hashes: objects with field-level access (`HGET user:1 name`) — memory-efficient for many small objects.
- Sorted sets: leaderboards, time-ordered feeds (`ZADD`, `ZRANGE ... REV`), sliding-window rate limiting.
- Streams: event log / job queue with consumer groups (`XADD`, `XREADGROUP`).
- Sets: tags, unique membership, `SINTER` for faceted filtering.
- Don't serialize everything into strings when a native structure gives you atomic ops.

## Key design

- Namespaced, descriptive: `tenant:{t}:user:{id}`, ` ratelimit:{ip}:{window}`. Include version when the shape changes: `user:v2:{id}` — deploy-safe invalidation.
- Keep keys short but readable; every byte × millions of keys matters.
- Hot keys: a single key hit 100k/sec melts one Redis node. Shard it (`user:{id}:{shard}`) or replicate to local in-process cache with short TTL.

## Correctness rules

- **Cache stampede**: on miss, many requests hit the DB at once. Fix with request coalescing (singleflight) or probabilistic early refresh (refresh at 80% of TTL in background).
- **Thundering on deploy**: stagger TTLs with jitter (`EX 300 + rand(60)`) so everything doesn't expire simultaneously.
- **Serialization**: JSON for interop, MessagePack for size. Version your payloads.
- **Eviction**: `maxmemory-policy allkeys-lru` (or `volatile-lru` if everything has TTL). Set `maxmemory` to ~70% of instance RAM.

## Redis as more than cache

- Distributed lock (Redlock or single-instance `SET NX PX` + Lua release with token check). Always set expiry; always verify ownership on release.
- Pub/Sub for fan-out (ephemeral — use Streams if you need persistence).

## Don'ts

- Don't treat cache as durable storage — it can be evicted or flushed anytime; the DB is the source of truth. Don't cache without TTL. Don't store sessions you can't afford to lose without a fallback. Don't `KEYS *` in production (use `SCAN`). Don't put large blobs (>100KB values) in hot paths — consider object storage + cache the pointer.

## Pipelining and transactions

- Pipeline independent commands: one round trip instead of N. In Node (`ioredis`): `const p = redis.pipeline(); p.get("a"); p.get("b"); const res = await p.exec();`
- `MULTI/EXEC` for atomic multi-key writes. For check-and-set logic, prefer Lua scripts (single atomic unit, no WATCH-retry loops).
- Avoid `WATCH`/`MULTI` retry loops under contention — Lua is simpler and correct.

## High availability

- Single primary + replicas: reads scale horizontally, writes go to primary. Clients must tolerate replica lag (read-your-write: read from primary right after a write).
- Sentinel or managed (ElastiCache/Memorystore) for failover. Cluster mode when one node isn't enough — but remember: multi-key ops must hash to the same slot (`{user:1}:profile`, `{user:1}:settings` share the `{user:1}` tag).
- Persistence: RDB snapshots + AOF for cache-warm restarts. For pure cache use, persistence is optional — size the tradeoff.

## Client-side caching (Redis 6+)

- `CLIENT TRACKING` lets Redis invalidate your local in-process cache on writes — near-zero latency reads with correctness. Use for extremely hot, rarely-changing data (feature flags, config).

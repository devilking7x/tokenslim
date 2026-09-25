---
id: postgres-indexing
name: PostgreSQL Indexing Guide
category: database
estTokens: 3100
---

Right index, right place. Every rule below maps to a real `CREATE INDEX`.

## B-tree (the default — start here)

- Equality + range + ordering on one index. Column order: equality first, then range, then `ORDER BY`:

```sql
-- WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC
CREATE INDEX idx_orders_tenant_status_created
  ON orders (tenant_id, status, created_at DESC);
```

- The leftmost-prefix rule: the index serves queries filtering on `(tenant_id)`, `(tenant_id, status)`, or all three — not on `(status)` alone.
- Multicolumn indexes beat multiple single-column indexes for combined filters.

## Partial indexes (smaller, faster)

- Index only the rows you query. Dramatically smaller when the predicate is selective:

```sql
CREATE INDEX idx_orders_unpaid ON orders (due_at)
  WHERE status = 'unpaid' AND deleted_at IS NULL;
```

- The query's `WHERE` must imply the index predicate, or the planner won't use it.

## Covering indexes (index-only scans)

- `INCLUDE` payload columns to answer queries without touching the heap:

```sql
CREATE INDEX idx_users_email_cover ON users (email) INCLUDE (id, name);
-- SELECT id, name FROM users WHERE email = $1  →  Index Only Scan
```

- Verify with `EXPLAIN`: look for `Index Only Scan`. Needs `VACUUM` to keep the visibility map fresh.

## Specialized index types

| Type | Use for | Example |
|---|---|---|
| GIN | jsonb containment, arrays, full-text, trigram | `CREATE INDEX ON docs USING gin (data jsonb_path_ops);` `... USING gin (title gin_trgm_ops)` |
| GiST | geometric, nearest-neighbor (`<->`), exclusion constraints | PostGIS, `ORDER BY geom <-> point LIMIT 10` |
| BRIN | huge, naturally ordered tables (time-series, logs) | `CREATE INDEX ON events USING brin (created_at);` — tiny, fast for append-only |
| Hash | simple equality only | Rarely needed; btree does equality too |

- Full-text: `to_tsvector` + GIN, not `LIKE '%...%'`:

```sql
CREATE INDEX idx_docs_fts ON docs USING gin (to_tsvector('english', title || ' ' || body));
SELECT * FROM docs WHERE to_tsvector('english', title || ' ' || body) @@ plainto_tsquery('english', $1);
```

- Expression indexes must match the query expression exactly: `CREATE INDEX ON users (lower(email));` serves `WHERE lower(email) = $1` only.

## Maintenance

- Find unused indexes: `SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0 AND indexrelname NOT LIKE '%pkey%';` — drop candidates after a full business cycle.
- Find missing indexes: `pg_stat_user_tables` with high `seq_scan` + `seq_tup_read` on large tables.
- `REINDEX CONCURRENTLY` for bloat; never plain `REINDEX` on a live table (locks writes).
- `CREATE INDEX CONCURRENTLY` in production — plain `CREATE INDEX` takes an exclusive lock.
- Keep `autovacuum` on and aggressive enough; dead tuples defeat index-only scans.

## Don'ts

- Don't index low-cardinality booleans alone (use partial indexes instead). Don't create an index per column "just in case" — each costs write throughput and planner time. Don't forget `CONCURRENTLY` in production. Don't index without checking `EXPLAIN` actually uses it.

## Monitoring index health

```sql
-- Bloat estimate per index (run monthly on large DBs)
SELECT schemaname, relname AS table, indexrelname AS index,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size,
       idx_scan AS scans
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
```

- Large index + zero scans = drop candidate. Large index + high scans = working as intended.
- Watch `pg_stat_database_conflicts` and long `AccessExclusiveLock` waits during migrations — a sign indexes are being rebuilt badly.

## Migrating indexes safely (zero-downtime recipe)

1. `CREATE INDEX CONCURRENTLY idx_new ON t (...);` — no write lock.
2. Verify with `EXPLAIN` on production-like data that the planner picks it.
3. `DROP INDEX CONCURRENTLY idx_old;` — only after the new one is proven in production traffic.
4. Never combine index changes with column changes in one migration — bisectable migrations save you during incidents.

## Ordering inside multicolumn indexes for sort-heavy queries

- When `ORDER BY a, b` is the hot path, index `(a, b)` in the same direction. Mixed directions need explicit per-column direction: `(a ASC, b DESC)`.
- `NULLS FIRST/LAST` in the query must match the index definition, or the sort falls back to an explicit sort step.

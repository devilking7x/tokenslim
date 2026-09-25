---
id: sql-optimization
name: SQL Query Optimization
category: database
estTokens: 3200
---

Write SQL that stays fast at 10x the data. Rules are ordered by impact.

## 1. Read the plan first

- `EXPLAIN (ANALYZE, BUFFERS)` every non-trivial query before optimizing. Optimize measured bottlenecks, not guesses.
- Look for: `Seq Scan` on large tables (missing index?), `Nested Loop` with huge row counts, `Sort` spilling to disk (`Sort Method: external merge`), high `Buffers: shared hit` vs `read` ratios.

## 2. Index what you filter, join, and sort

- Index columns in `WHERE` equality, `JOIN ... ON`, and `ORDER BY` — ideally one composite index covering all three in the right order: equality columns first, then range, then sort.
- Example: `WHERE tenant_id = ? AND created_at > ? ORDER BY created_at DESC` → `CREATE INDEX ON orders (tenant_id, created_at DESC);`
- Covering indexes: `INCLUDE` columns you only `SELECT` to get index-only scans: `CREATE INDEX ON orders (tenant_id) INCLUDE (total, status);`
- Don't index everything: every index slows writes and costs storage. Drop unused indexes (check `pg_stat_user_indexes.idx_scan = 0`).

## 3. Kill the N+1

- Never query in a loop. One query with a `JOIN` or `WHERE id = ANY($1)` beats N queries always.
- In ORMs: use eager loading (`include`/`preload`/`select_related`) and verify with query logging in development.

## 4. Select only what you need

- No `SELECT *` in application code. Name columns. Wide rows kill buffer cache efficiency and network time.
- Push filtering to the database: `WHERE`, `LIMIT`, aggregates in SQL — not in application memory.

## 5. Pagination that scales

- `OFFSET` is O(offset): page 10,000 reads and discards 10,000 rows. Use keyset (cursor) pagination:

```sql
SELECT id, created_at FROM orders
WHERE tenant_id = $1 AND (created_at, id) < ($2, $3)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

- Requires a composite index on `(tenant_id, created_at DESC, id DESC)`.

## 6. Write efficient joins and filters

- Filter before joining: put selective `WHERE` conditions so the planner reduces rows early; use CTEs or subqueries to pre-filter.
- Avoid functions on indexed columns in `WHERE` — `WHERE DATE(created_at) = ...` defeats the index. Use ranges: `WHERE created_at >= $1 AND created_at < $2`.
- `LIKE '%foo'` can't use a btree index; use `pg_trgm` (`CREATE EXTENSION pg_trgm; CREATE INDEX ... USING gin (col gin_trgm_ops);`) or full-text search (`to_tsvector`).
- Prefer `EXISTS` over `IN (subquery)` for semi-joins; the planner often handles it better and it short-circuits.

## 7. Aggregates and heavy queries

- Pre-aggregate: materialized views or summary tables refreshed on a schedule for dashboards.
- `COUNT(*)` on huge tables without `WHERE` is a full scan — use estimated counts (`pg_class.reltuples`) or a counter table for "approximately N".
- Batch writes: multi-row `INSERT ... VALUES (...), (...), ...` or `COPY` — never one INSERT per row in a loop.

## 8. Transactions

- Keep transactions short: no network calls or user input inside a transaction. Long transactions bloat tables and block `VACUUM`.
- Right isolation level: default `READ COMMITTED`; use `REPEATABLE READ`/`SERIALIZABLE` only where correctness demands it.
- Deadlock avoidance: always lock rows in a consistent order (e.g., by primary key ascending).

## Don'ts

- Don't `ORDER BY` without `LIMIT` on unbounded queries. Don't `SELECT DISTINCT` to paper over a bad join — fix the join. Don't store comma-separated values in a column; normalize or use arrays/jsonb with a GIN index.

## Locking reads

- `SELECT ... FOR UPDATE` locks rows for the transaction — use for read-modify-write (decrement inventory, claim a job). Always inside a short transaction, rows locked in consistent (PK) order.
- `FOR UPDATE SKIP LOCKED` for job queues: workers skip rows already claimed instead of blocking. The canonical queue pattern:

```sql
SELECT id FROM jobs
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

## JSONB and arrays

- `jsonb` for genuinely schemaless payloads, with GIN indexes on queried paths: `CREATE INDEX ON events USING gin (payload);` then `WHERE payload @> '{"type":"click"}'`.
- Don't use jsonb as an excuse to avoid schema design for core domain fields — typed columns are faster, constrainable, and self-documenting.
- Prefer `jsonb` over `json` (binary, indexable). Use `->>` for text extraction in `WHERE` clauses.

## Vacuuming and statistics

- `autovacuum` must stay on. After bulk loads/updates, run `ANALYZE` manually so the planner sees fresh statistics — stale stats are a top cause of sudden plan regressions.
- `VACUUM (VERBOSE, ANALYZE)` to diagnose bloat. Chronically bloated tables with heavy updates: lower `fillfactor` (e.g. 80) to leave room for HOT updates.

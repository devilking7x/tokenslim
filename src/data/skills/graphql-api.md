---
id: graphql-api
name: GraphQL API Design
category: backend
estTokens: 3000
---

GraphQL trades REST's simplicity for client flexibility. Earn it with this discipline.

## Schema design

- Schema-first: the `.graphql` SDL is the contract. Generate types from it (graphql-codegen), never hand-write matching types twice.
- Nullable by default is a lie — mark fields non-null (`!`) when they always resolve. `user: User!`, `users: [User!]!`. Clients can then skip null checks and codegen types are honest.
- Connections for pagination (Relay spec): `edges { node cursor } pageInfo { hasNextPage endCursor }`. Cursor = opaque base64 of `(sortKey, id)`.
- Mutations take a single `input` object and return a payload type with the changed object + `errors`:

```graphql
input CreateOrderInput { items: [OrderItemInput!]!, couponCode: String }
type CreateOrderPayload { order: Order, errors: [UserError!]! }
type UserError { code: String!, message: String!, field: String }
```

- Use custom scalars for domain types: `DateTime`, `Email`, `URL`, `Money`. Validate at the scalar boundary.
- Enums for closed sets (`OrderStatus`), not strings.

## Resolvers and the N+1 problem

- Every nested field is a potential N+1. Solve with **DataLoader** (batching + per-request caching) — not optional:

```ts
// per-request loaders
const userLoader = new DataLoader(async (ids: readonly string[]) => {
  const users = await db.user.findMany({ where: { id: { in: [...ids] } } });
  const byId = new Map(users.map(u => [u.id, u]));
  return ids.map(id => byId.get(id) ?? new Error(`User ${id} not found`));
});
// resolver: (order) => userLoader.load(order.userId)
```

- DataLoader instances live per-request (never global — that's a cross-request cache leak).
- Field-level authorization in resolvers: check permission before resolving sensitive fields, not just at the top-level query.

## Queries in production

- **Persisted queries** (or at minimum query allowlisting): clients send a hash, server maps to the stored document. Kills query-injection probing and enables aggressive caching.
- **Complexity/depth limiting**: assign costs, reject queries over budget (`graphql-validation-complexity`, max depth ~10). Without this, one nested query DoSes your DB.
- **Timeouts**: per-query timeout (e.g. 10s). Introspection disabled in production.
- Rate limit by query complexity, not just request count.

## Errors

- Partial data is normal: `data` + `errors` coexist. Clients must handle both.
- Error shape: `{ message, extensions: { code, field? } }`. Use codes (`UNAUTHENTICATED`, `FORBIDDEN`, `BAD_USER_INPUT`, `NOT_FOUND`, `INTERNAL`) — clients switch on codes, not messages.
- `BAD_USER_INPUT` for validation (with field-level details); never leak internals in `INTERNAL` — log the real error server-side.

## When NOT to use GraphQL

- Simple CRUD with one client → REST is less machinery. Public APIs consumed by many untrusted clients → REST's cacheability and simplicity win. Use GraphQL where the client set is known and field selection genuinely varies (dashboards, mobile with bandwidth constraints).

## Don'ts

- Don't expose the raw DB schema as the GraphQL schema — design a product API. Don't allow unbounded nesting without complexity limits. Don't share DataLoader across requests. Don't put auth logic only at the query root — authorize every field that needs it. Don't enable introspection in production.

## Federation vs monolith

- Start with a monolithic schema (one service). Split into federated subgraphs only when teams/services genuinely need independent deploys — federation adds gateway ops, composition checks, and cross-subgraph debugging cost.
- If federating (Apollo Federation): `@key` directives for entity resolution, `_entities` for cross-subgraph references. Keep the gateway thin — no business logic.

## Caching GraphQL

- HTTP caching works if you use persisted queries via GET (hash in URL) — CDN-cacheable like REST. Arbitrary POST queries are not cacheable; that's the cost of flexibility.
- Field-level cache hints (`@cacheControl(maxAge: 60, scope: PRIVATE)`) with a gateway that understands them.

## Subscriptions

- Use for genuinely real-time needs (live dashboards, chat). Transport: WebSocket (`graphql-ws` protocol) or SSE for server→client only.
- Authenticate the connection upgrade, authorize each subscription event (filter per-user in the event stream, not just at subscribe time).
- Backpressure: slow consumers get disconnected, not buffered unboundedly. Cap per-connection subscription count.

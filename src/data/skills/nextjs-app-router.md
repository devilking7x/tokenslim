---
id: nextjs-app-router
name: Next.js App Router Essentials
category: frontend
estTokens: 3000
---

The App Router mental model: Server Components by default, Client Components only for interactivity.

## Server vs Client Components

- Default: Server Component. Runs on the server, can be async, can touch the DB directly. Zero JS shipped.
- Add `"use client"` ONLY when you need: event handlers, `useState`/`useEffect`, browser APIs. Push the boundary down — make the page a Server Component and isolate the interactive widget as a small Client Component leaf.
- Never import a Server Component into a Client Component file. Pass server-rendered content as `children`/`props` instead (composition pattern).
- Data fetching: `async` Server Components fetch directly. No `useEffect` fetching, no waterfalls — fetch in parallel with `Promise.all`.

```tsx
// app/orders/page.tsx — Server Component
export default async function OrdersPage() {
  const [orders, user] = await Promise.all([getOrders(), getUser()]);
  return <OrdersTable orders={orders} user={user} />;
}
```

## Routing and layouts

- File-system routing: `app/dashboard/page.tsx` → `/dashboard`. `app/blog/[slug]/page.tsx` → dynamic param via `params`.
- `layout.tsx` wraps all children in its segment — use for nav/shell. `template.tsx` is the same but remounts on navigation (use for enter animations, not layout).
- Route groups `(marketing)/` organize without affecting URLs. Private folders `_components/` are excluded from routing.
- `loading.tsx` = instant Suspense fallback for the segment. `error.tsx` (must be Client Component) = error boundary. `not-found.tsx` for 404s. Always provide all three on important segments.

## Server Actions

- Mutations live in Server Actions, not API routes you hand-roll for forms:

```ts
// app/orders/actions.ts
"use server";
export async function createOrder(formData: FormData) {
  const data = OrderSchema.parse(Object.fromEntries(formData));
  const order = await db.order.create(data);
  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}
```

- Validate with zod on the server — client validation is UX, server validation is security.
- `revalidatePath`/`revalidateTag` after mutations. `redirect()` and `notFound()` throw internally — don't wrap them in try/catch that swallows.

## Caching (the part everyone gets wrong)

- `fetch` in Server Components is cached by default (force-cache). Opt out deliberately: `fetch(url, { cache: "no-store" })` or `next: { revalidate: 60 }` for ISR.
- Route Handlers (`route.ts`): `GET` is cached by default too — export `const dynamic = "force-dynamic"` when it must run per-request.
- `unstable_cache` for expensive non-fetch work (DB queries) with tag-based invalidation.

## Metadata and SEO

- Export `metadata` (or `generateMetadata`) per page: title, description, openGraph. Use a title template in the root layout: `title: { template: "%s | Acme", default: "Acme" }`.
- `generateStaticParams` for static dynamic routes. `dynamicParams = false` to 404 unknown slugs at build.

## Don'ts

- Don't fetch in Client Components with useEffect when a Server Component can do it. Don't put secrets in Client Components (they ship to the browser — check the bundle). Don't use `useSearchParams` without a `<Suspense>` boundary (it forces client-side rendering of the whole page). Don't ignore the `"use client"` bundle cost — audit with `@next/bundle-analyzer`.

## Route Handlers (route.ts)

- Use for: webhooks, API endpoints consumed by non-React clients, streaming responses, raw body access.
- Signature: `export async function POST(req: NextRequest) { ... }`. Return `NextResponse.json(...)`.
- Raw body (for webhook signatures): `const raw = await req.text()` — do NOT `await req.json()` first if you need the bytes.
- Segment config for dynamic behavior:

```ts
export const dynamic = "force-dynamic";  // no caching
export const runtime = "nodejs";         // or "edge" for lightweight handlers
export const revalidate = 60;            // ISR for GET handlers
```

- Validate everything with zod at the handler boundary; return 400 with field errors on failure.

## Middleware (middleware.ts)

- Runs before routing: auth checks, redirects, A/B assignment, geo-based routing.
- Keep it light — it runs on every matched request. No DB calls; verify JWTs with the public key (jose works on edge).
- `matcher` config to scope it: `export const config = { matcher: ["/dashboard/:path*"] }`.

## Performance checklist

- Images: `next/image` with explicit sizes — automatic AVIF/WebP, lazy loading, no CLS.
- Fonts: `next/font` — self-hosted, zero layout shift, no external request.
- `<Link prefetch>` for instant navigations. `loading.tsx` skeletons shaped like the real content.

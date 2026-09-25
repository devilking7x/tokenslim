---
id: react-patterns
name: React Patterns for AI-Built Apps
category: frontend
estTokens: 2800
---

Seniors use these rules when writing React. Apply all of them.

## Component shape

- One component per file. Keep components under ~150 lines. Extract logic into custom hooks when a component grows.
- Use function components + hooks only. No classes.
- Props: destructure in the signature, type with an interface named `<Component>Props`.
- Default parameter values, not `defaultProps`:

```tsx
interface ButtonProps { variant?: "primary" | "ghost"; onClick?: () => void; children: React.ReactNode; }
export function Button({ variant = "primary", children, onClick }: ButtonProps) { ... }
```

## State placement

- State lives as low as possible. Lift only when two siblings truly need it.
- Derived data does NOT get state. Compute inline or with `useMemo` only when the computation is expensive (>~ms of work) or referentially unstable for a memoized child.
- Prefer a reducer (`useReducer`) over 3+ `useState` calls managing related fields (forms, wizards, editors).
- Never store the same data in two places (e.g., a filtered copy). Store the source and derive the rest.

## Effects

- `useEffect` is for synchronizing with external systems (network, DOM APIs, subscriptions, timers). It is NOT a general "when X changes, do Y" tool.
- No derived state in effects. No event logic in effects. If you can compute it during render or inside an event handler, do that instead.
- Cleanup everything you subscribe to:

```tsx
useEffect(() => {
  const controller = new AbortController();
  fetch("/api/users", { signal: controller.signal }).then(r => r.json()).then(setUsers);
  return () => controller.abort();
}, []);
```

- Dependency arrays: include every reactive value used inside. Run `react-hooks/exhaustive-deps` and fix warnings, don't suppress them.

## Data fetching pattern

- Fetch in effects only for fire-and-forget needs. For UI data, use a library (React Query / SWR / TanStack Query). It gives you caching, dedup, retries, and loading states for free.
- Loading/error/empty/data: always render all four states. Never render a blank screen while loading.

```tsx
const { data, isLoading, isError } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
if (isLoading) return <Spinner />;
if (isError) return <ErrorState retry={refetch} />;
if (!data?.length) return <EmptyState />;
```

## Performance

- Don't pre-optimize. Fix real bottlenecks, found via React DevTools Profiler.
- When you do optimize: `React.memo` for expensive leaf components, `useMemo`/`useCallback` only to stabilize props passed to memoized children or to effect deps.
- Lists: stable `key` from data (id), never array index when order can change.
- Split code with `React.lazy` at route boundaries. Keep `Suspense` fallbacks meaningful.

## Composition over props bloat

- A component taking 8+ props is a smell. Compose instead: `children`, `slots`, or compound components (`<Card><Card.Header/><Card.Body/></Card>`).
- For styling variants, use a variant utility (cva/class-variance-authority) instead of boolean prop soup.

## Don'ts

- Don't mutate state directly; always produce new objects/arrays.
- Don't use `useRef` as a substitute for state that should trigger a re-render.
- Don't put keys on components to "force remount" unless you can explain why the identity actually changed.
- Don't fetch in render. Don't setState during render (except the documented "adjust state during render" pattern).

## Forms and inputs

- Controlled inputs for validation-heavy forms; uncontrolled (`ref`/`FormData`) for simple ones. Don't mix per-field.
- For non-trivial forms use React Hook Form or TanStack Form — hand-rolled `onChange` state per field re-renders the whole form on every keystroke.
- Validate on submit + on blur for touched fields. Show one error per field, next to the field, with `aria-describedby` linking input to error for screen readers.
- Disable the submit button while submitting AND guard with a ref — double-clicks cause duplicate mutations.
- After success: reset the form, show confirmation, navigate or update the list. After failure: keep user input intact, focus the first invalid field.

## Context and global state

- Context is for dependency injection (theme, current user, locale) — not a state manager. Context updates re-render all consumers; splitting into multiple contexts limits the blast radius.
- For true global client state (carts, toasts, filters), use Zustand/Jotai/Redux Toolkit — with selectors so components subscribe to slices, not the whole store.
- Server state (fetched data) belongs in React Query, never in a global store. Mixing them causes stale-data bugs that are painful to trace.

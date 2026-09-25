---
id: typescript-strict
name: TypeScript Strict Mode Playbook
category: frontend
estTokens: 2800
---

`strict: true` is the floor. These rules get you the rest of the value.

## tsconfig baseline

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "erasableSyntaxOnly": true
  }
}
```

- `noUncheckedIndexedAccess`: `arr[i]` is `T | undefined` — kills the most common runtime crash class.
- `exactOptionalPropertyTypes`: `foo?: string` no longer accepts explicit `undefined` — be deliberate about optionality.
- Fix `strict` errors by fixing types, never by sprinkling `any`.

## Type design

- Prefer `interface` for object shapes, `type` for unions/intersections/aliases.
- Model states with discriminated unions, not boolean flags:

```ts
type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: User[] };
// switch (s.status) narrows exhaustively — add `default: assertNever(s)` for compile-time safety
```

- `unknown` over `any` at every boundary (JSON.parse, API responses, catch clauses — `useUnknownInCatchVariables` is on under strict). Narrow with type guards:

```ts
function isUser(v: unknown): v is User {
  return typeof v === "object" && v !== null && "id" in v && typeof (v as any).id === "string";
}
```

- Validate external data at runtime with zod/valibot and infer the type: `const UserSchema = z.object({...}); type User = z.infer<typeof UserSchema>;` — one source of truth.

## Functions and generics

- Annotate return types on exported functions. Inference is fine for locals.
- Constrain generics: `<T extends { id: string }>` not bare `<T>`. Prefer inference at call sites over explicit type arguments.
- `readonly` arrays/props by default (`readonly string[]`); mutability is opt-in.
- No enums — use `as const` objects + `keyof typeof` unions. Enums emit runtime code and behave oddly across isolatedModules.

```ts
const Role = { Admin: "admin", User: "user" } as const;
type Role = (typeof Role)[keyof typeof Role];
```

## Async and errors

- `async` functions always return `Promise<T>` — annotate it.
- `Promise.all` fails fast; use `Promise.allSettled` when partial failure is acceptable, and handle the rejected branch explicitly.
- Never floating promises: `await` or `void promise.catch(log)`. Enable `@typescript-eslint/no-floating-promises`.

## Narrowing discipline

- Prefer early returns over nested ifs. After `if (!x) throw/return`, `x` is narrowed — use it.
- Assertion functions for invariants: `function assert(cond: unknown, msg: string): asserts cond { if (!cond) throw new Error(msg); }`
- `satisfies` to check a value against a type without widening it: `const cfg = {...} satisfies Config;`

## Don'ts

- No `any` (use `unknown` + narrow). No `@ts-ignore` (use `@ts-expect-error` with a comment, so it fails loudly when unnecessary). No non-null assertion `!` in library code — prove it instead. No type assertions (`as`) to lie about API shapes — validate instead. No `Function` type, no `Object` type.

## ESLint pairing (typescript-eslint)

```js
// eslint.config.js
export default [
  ...tseslint.configs.strictTypeChecked,
  {
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
```

- `strictTypeChecked` needs `parserOptions.projectService` — it gives you type-aware rules (unnecessary conditions, unsafe any-access) that catch real bugs.
- Zero warnings policy in CI (`--max-warnings 0`). Warnings nobody reads are comments with extra steps.

## Boundary discipline in monorepos

- `verbatimModuleSyntax`: `import type` for types — makes type-only imports erasable and avoids runtime import cycles.
- Public package APIs: explicit return types, no leaked internals. Internal modules: inference is fine.
- `tsc --noEmit` in CI on every PR. Type errors are build failures, not suggestions.

## Gradual strictness adoption

- Enabling strict on a legacy codebase: turn on `strict: true` plus one extra flag at a time (`noUncheckedIndexedAccess` first — highest bug value), fix the errors, commit, repeat. Big-bang strictness on 100k lines stalls; incremental wins.
- Track remaining `any`s: `grep -rn ": any" src | wc -l` in CI with a ratchet (fail if the count grows).

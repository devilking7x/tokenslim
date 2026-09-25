---
id: testing-vitest
name: Testing with Vitest
category: testing
estTokens: 2700
---

Fast, useful tests. Vitest config and patterns that survive real codebases.

## Setup

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",          // or "jsdom"/"happy-dom" for DOM tests
    globals: false,              // import from "vitest" explicitly — clearer
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["**/*.test.ts", "**/test-utils/**"],
    },
    testTimeout: 5000,
    // isolate: true (default) — each test file gets a fresh module graph
  },
});
```

- Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:cov": "vitest run --coverage"`.
- `vitest run` in CI (single run, exits). Watch mode locally only.

## What to test (the pyramid, enforced)

1. **Unit** (most): pure functions, validators, parsers, business rules. Fast (<10ms each), no I/O.
2. **Integration**: route handlers with a real test database (spun up via testcontainers or a dedicated test DB), repository + query correctness.
3. **E2E** (few): critical user paths only (signup → checkout), via Playwright against a staging-like env.

- Test behavior, not implementation: assert outputs and side effects, not internal calls. Refactors shouldn't break tests.

## Patterns

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("calculateTotal", () => {
  it("applies discount and tax", () => {
    expect(calculateTotal({ items: [{ price: 100, qty: 2 }], discountPct: 10, taxPct: 8 }))
      .toBeCloseTo(194.4);
  });
  it("rejects negative prices", () => {
    expect(() => calculateTotal({ items: [{ price: -1, qty: 1 }] })).toThrow(InvalidPriceError);
  });
});
```

- One behavior per `it`. Name tests as specifications: `"rejects expired tokens"`, not `"test2"`.
- Arrange-Act-Assert. Keep tests short; extract builders/factories for fixtures (`makeUser({ role: "admin" })`).
- Async: `await expect(promise).rejects.toThrow(...)`. Never leave floating promises — unhandled rejections fail silently.
- Time: `vi.useFakeTimers()` + `vi.setSystemTime()` for expiry/scheduling logic. Restore with `vi.useRealTimers()` in `afterEach`.
- Mocks: `vi.mock("./mailer")` at module level for external services. Prefer fakes over mocks where feasible (in-memory repository > mocked repository). Mock at the boundary (HTTP client, DB driver), never the unit under test.

## Database tests

- Each test file (or test) runs in a transaction rolled back afterward, or truncates tables in `beforeEach`. Tests must be order-independent and parallel-safe.
- Seed minimal data per test. Shared global seeds create coupling and mystery failures.

## CI discipline

- Fail CI below a coverage floor only if the team maintains it honestly (e.g. `--coverage --coverage.thresholds.lines=80`); a gamed metric is worse than none.
- Tests must be deterministic: no real network, no real clocks, no shared mutable state. Flaky test → quarantine immediately, fix or delete within the sprint.

## Don'ts

- Don't test framework code (that React renders, that the router routes). Don't assert exact mock call counts unless the contract is about calls. Don't share state between tests. Don't commit `.only`/`describe.only` — CI should fail on it (`--dangerouslyIgnoreUnhandledErrors` won't catch it; use an eslint rule `no-focused-tests`).

## Snapshot testing: use sparingly

- Snapshots are good for: serialized output formats, error messages, generated SQL/config. They are bad for: component markup (brittle, reviewed never).
- Rule: if a snapshot diff wouldn't tell a human what broke, delete the snapshot and write an assertion instead.
- `--update` snapshots deliberately after reviewing the diff, never blindly to make CI green.

## Test doubles: the hierarchy

1. Real implementation (preferred: real parser, real validator).
2. Fake (in-memory DB, in-memory queue) — behaves like the real thing.
3. Stub (canned responses).
4. Mock (verify interactions) — last resort, only when the interaction IS the contract (e.g. "sends exactly one email").

## Property-based testing

- For parsers, encoders, and math: use fast-check to generate hundreds of inputs. Catches edge cases example-tests miss:

```ts
import fc from "fast-check";
it("round-trips through encode/decode", () => {
  fc.assert(fc.property(fc.string(), s => decode(encode(s)) === s));
});
```

- Seed failures are reproducible (`fc.assert` prints the seed). Add the failing case as a regression example test.

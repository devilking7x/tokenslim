/**
 * Generates src/data/skills-registry.json: 350 lightweight skill registry
 * entries (35 per category x 10 categories).
 *
 * Deterministic (seeded RNG) so re-runs produce identical output.
 * Run: pnpm gen-skills
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "data");
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- seeded RNG
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260925);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const titleCase = (s) =>
  s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

// ------------------------------------------------------- the 18 full skills
/** [id, category, name, description] */
const CURATED = [
  ["react-patterns", "frontend", "React Patterns", "Battle-tested component patterns: composition, colocation, and state ownership."],
  ["typescript-strict", "frontend", "TypeScript Strict Mode", "Zero-any discipline, exhaustive narrowing, and type-level testing recipes."],
  ["nextjs-app-router", "frontend", "Next.js App Router", "Server components, caching semantics, and route-level data flow."],
  ["api-design", "backend", "API Design", "REST resource modeling, versioning, and error-envelope conventions."],
  ["redis-caching", "backend", "Redis Caching", "Cache keys, TTL strategy, stampede protection, and invalidation patterns."],
  ["webhooks-design", "backend", "Webhooks Design", "Idempotency, retries with backoff, signature verification, and ordering."],
  ["graphql-api", "backend", "GraphQL API", "Schema design, dataloader batching, and pagination that survives growth."],
  ["error-handling", "backend", "Error Handling", "Result types, typed errors, retries, and failure budgets that degrade well."],
  ["sql-optimization", "database", "SQL Optimization", "Reading query plans, sargability, and the 80/20 of fast queries."],
  ["postgres-indexing", "database", "Postgres Indexing", "B-tree, GIN, and partial indexes — plus when NOT to index."],
  ["docker-deploy", "devops", "Docker Deploy", "Multi-stage builds, layer caching, and minimal attack-surface images."],
  ["ci-cd-github-actions", "devops", "CI/CD with GitHub Actions", "Cache-aware pipelines, matrix builds, and safe deployments."],
  ["kubernetes-basics", "devops", "Kubernetes Basics", "Pods, services, probes, and resource limits that prevent noisy neighbors."],
  ["testing-vitest", "testing", "Testing with Vitest", "Fast unit tests, mocking boundaries, and flake-free async testing."],
  ["auth-jwt", "security", "Auth with JWT", "Access/refresh token lifecycle, rotation, revocation, and storage safety."],
  ["oauth2-flows", "security", "OAuth2 Flows", "Choosing authorization-code + PKCE vs client-credentials, and doing it right."],
  ["prompt-compression", "ai-agents", "Prompt Compression", "Shrinking system prompts with progressive disclosure and compression."],
  ["rate-limiting", "performance", "Rate Limiting", "Token buckets, sliding windows, and per-key limits that protect backends."],
];

// ------------------------------------------------- per-category topic pools
// 12 base topics x 3 suffixes = 36 variants (>= 35 needed after curated).
const SUFFIXES = ["", "at scale", "in production"];

const CATS = {
  frontend: [
    "component composition", "state management", "server-side rendering", "bundle optimization",
    "css architecture", "accessibility audits", "form handling", "routing strategies",
    "image optimization", "web vitals tuning", "micro-frontends", "design systems",
  ],
  backend: [
    "middleware pipelines", "background jobs", "request validation", "pagination patterns",
    "file uploads", "email delivery", "search integration", "feature flags",
    "api gateways", "message queues", "scheduled tasks", "multi-tenancy",
  ],
  database: [
    "connection pooling", "migration strategy", "query batching", "read replicas",
    "schema versioning", "deadlock diagnosis", "full-text search", "partitioning",
    "transaction isolation", "backup restores", "audit logging", "sharding keys",
  ],
  devops: [
    "log aggregation", "secret rotation", "blue-green deploys", "infrastructure as code",
    "health checks", "autoscaling policies", "artifact registries", "canary releases",
    "network policies", "backup drills", "cost tagging", "incident runbooks",
  ],
  testing: [
    "contract testing", "snapshot discipline", "load testing", "mutation testing",
    "test data factories", "e2e selectors", "coverage strategy", "visual regression",
    "property-based tests", "api test doubles", "flaky test triage", "performance budgets",
  ],
  security: [
    "csrf defenses", "content security policy", "secret scanning", "dependency audits",
    "session fixation", "password hashing", "api key rotation", "ssrf prevention",
    "input sanitization", "audit trails", "least privilege iam", "tls hardening",
  ],
  "ai-agents": [
    "tool calling", "memory management", "eval harnesses", "retrieval tuning",
    "guardrail design", "streaming ux", "multi-agent routing", "context budgets",
    "fallback chains", "prompt versioning", "hallucination checks", "cost attribution",
  ],
  performance: [
    "lazy loading", "cdn caching", "database n+1 fixes", "payload shrinking",
    "connection reuse", "worker pools", "memory profiling", "hot path tracing",
    "compression tuning", "prefetch strategy", "render blocking", "queue backpressure",
  ],
  mobile: [
    "offline sync", "push notifications", "battery profiling", "deep linking",
    "app store metadata", "biometric auth", "background fetch", "crash reporting",
    "on-device caching", "permission flows", "ota updates", "adaptive layouts",
  ],
  docs: [
    "api references", "getting-started guides", "changelog discipline", "diagram standards",
    "runbook writing", "adr templates", "code examples", "glossary maintenance",
    "search indexing", "versioned docs", "onboarding paths", "style guides",
  ],
};

const DETAILS = [
  "Checklists, anti-patterns, and copy-paste-ready templates included.",
  "Focused on the 20% of techniques that fix 80% of real-world issues.",
  "Includes decision flowcharts for when each pattern applies.",
  "Written for teams inheriting messy codebases under deadline pressure.",
  "Prioritizes measurable outcomes over theoretical purity.",
  "Each rule pairs with a concrete before/after example.",
];

const DESC_TEMPLATES = [
  (t, d) => `Practical guide to ${t}. ${d}`,
  (t, d) => `How to get ${t} right the first time. ${d}`,
  (t, d) => `A field manual for ${t} — common pitfalls and proven fixes. ${d}`,
  (t, d) => `${t.charAt(0).toUpperCase() + t.slice(1)} done properly: patterns, trade-offs, and recipes. ${d}`,
];

// ------------------------------------------------------------------ build
const entries = [];
const usedIds = new Set();

for (const [category, topics] of Object.entries(CATS)) {
  const curated = CURATED.filter((c) => c[1] === category);
  const need = 35 - curated.length;
  const made = [];

  // curated first (stable ids)
  for (const [id, , name, description] of curated) {
    made.push({ id, name, category, description, estTokens: int(60, 110) });
    usedIds.add(id);
  }

  // generated variants
  let topicIdx = 0;
  outer: for (const topic of topics) {
    for (const suffix of SUFFIXES) {
      if (made.length >= 35) break outer;
      const name = titleCase(suffix ? `${topic} ${suffix}` : topic);
      let id = slug(name);
      if (usedIds.has(id)) continue;
      usedIds.add(id);
      const tpl = DESC_TEMPLATES[topicIdx % DESC_TEMPLATES.length];
      const description = tpl(topic, pick(DETAILS));
      made.push({ id, name, category, description, estTokens: int(40, 120) });
      topicIdx++;
    }
  }

  if (made.length !== 35) {
    throw new Error(`category ${category}: made ${made.length}, expected 35`);
  }
  entries.push(...made);
}

if (entries.length !== 350) {
  throw new Error(`total entries ${entries.length}, expected 350`);
}

// verify curated ids intact
for (const [id] of CURATED) {
  if (!entries.some((e) => e.id === id)) throw new Error(`missing curated id ${id}`);
}

writeFileSync(join(outDir, "skills-registry.json"), JSON.stringify(entries, null, 2) + "\n");
console.log(`wrote ${entries.length} registry entries -> src/data/skills-registry.json`);

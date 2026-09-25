---
id: ci-cd-github-actions
name: GitHub Actions CI/CD
category: devops
estTokens: 3000
---

Fast, reliable pipelines. Copy this structure, then adapt.

## Canonical CI workflow

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true   # kill stale runs on new pushes

jobs:
  build-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test -- --coverage
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: debug-logs, path: logs/ }
```

## Speed rules

- `npm ci` + `cache: npm` (or pnpm/store, pip cache, Go modules). Cache is the cheapest speedup.
- `concurrency.cancel-in-progress: true` — never burn minutes on superseded PR pushes.
- Split slow jobs (lint / typecheck / unit / integration) into parallel jobs; total wall time = slowest job, not the sum.
- Matrix only where it pays: `[22, 20]` Node versions for libraries; for apps, test the one version you deploy.
- Self-hosted or larger runners only after you've exhausted caching and parallelism.

## CD: build once, promote

```yaml
  publish:
    needs: build-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t ghcr.io/org/app:${{ github.sha }} .
      - run: docker push ghcr.io/org/app:${{ github.sha }}
```

- One artifact per commit (image tagged by SHA). Deploy = point the environment at the SHA. Never rebuild between staging and prod.
- Environments with protection rules: `environment: production` + required reviewers for prod deploys.
- Prefer OIDC over long-lived secrets: `id-token: write` + cloud IAM federation (AWS/GCP/Azure all support it). No static cloud keys in repo secrets.

## Secrets and security

- Least privilege: set `permissions:` per job (default `contents: read`), never broad `write` at the top.
- Pin third-party actions to a full SHA, not a moving tag (`actions/checkout@b4ff...`, not `@v4`) — tags can be retargeted.
- Never `echo` secrets; GitHub masks them, but avoid anyway. Never pass secrets to untrusted code (PRs from forks): use `pull_request_target` carefully or don't run privileged jobs on fork PRs at all.
- Dependabot/Renovate for action version bumps.

## Branch discipline

- `main` is always deployable: every merge passes CI. Feature branches → PR → squash merge.
- Required status checks on `main` (the CI job), plus required reviews. No direct pushes.
- Semantic or conventional commits if you do automated releases; otherwise don't bother.

## Observability

- Job summaries (`$GITHUB_STEP_SUMMARY`) for test reports and deploy URLs — visible without digging through logs.
- Notify on failure (Slack/Discord webhook) for `main` only; PR failures notify via the PR itself.
- Keep logs: default 90-day retention is fine; upload test reports/coverage as artifacts.

## Don'ts

- Don't deploy from a PR branch to production. Don't store secrets in workflow files or build args. Don't let CI take 30 minutes — developers route around slow CI. Don't use `latest` tags for deploy artifacts. Don't run `npm install` (use `ci`).

## Reusable workflows (DRY across repos)

```yaml
# .github/workflows/deploy.yml in the app repo
jobs:
  deploy-staging:
    uses: org/shared-workflows/.github/workflows/deploy.yml@<sha>
    with: { environment: staging, image: ghcr.io/org/app:${{ github.sha }} }
    secrets: inherit   # only within the same org; prefer explicit secret passing
```

- Pin reusable workflows to SHAs like actions. Keep shared workflows in one repo with their own CI.

## Database migrations in the pipeline

- Migrations run as a separate job before deploy, with a timeout and automatic rollback plan. Never run migrations from app startup code (multiple replicas race).
- Backward-compatible migrations only on the deploy path: expand (add column/table) → deploy → migrate (backfill) → contract (drop old). The app must run against both schemas during rollout.

## Preview environments

- Per-PR ephemeral environments (Vercel/Netlify preview, or k8s namespaces per PR) with seeded data. Tear down on PR close (`if: github.event.action == 'closed'`).
- Post the preview URL as a PR comment via `$GITHUB_STEP_SUMMARY` or the deployments API.

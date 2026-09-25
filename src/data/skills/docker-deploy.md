---
id: docker-deploy
name: Docker Deploy Playbook
category: devops
estTokens: 3000
---

Ship containers that are small, fast, and reproducible. Copy these patterns verbatim.

## Multi-stage Dockerfile (Node example)

```dockerfile
# 1. deps — cached unless lockfile changes
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 2. build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 3. runtime — minimal, non-root
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

## Rules

- Pin base image versions (`node:22-alpine`, never `node:latest`). Reproducible builds beat surprise upgrades.
- `.dockerignore` must exclude `node_modules`, `.git`, `*.md`, `.env`, test files, local build output. A bloated build context is the #1 slow-build cause.
- Order layers by change frequency: lockfile → deps → source → build. Never `COPY . .` before `npm ci`.
- Run as non-root (`USER app`). Root in container + container escape = host compromise.
- One process per container. Use `--init` or `tini` so signals (SIGTERM) reach your app for graceful shutdown.
- `HEALTHCHECK` on every service. Orchestrators use it to decide restarts and routing.

## Configuration

- Config via environment variables, never baked into the image. Secrets via secret mounts/env from the orchestrator — never `ENV SECRET=...` in the Dockerfile, never committed `.env`.
- Validate required env at startup and fail fast with a clear message (`if (!process.env.DATABASE_URL) throw ...`).

## Compose for local/dev parity

```yaml
services:
  api:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
    restart: unless-stopped
  db:
    image: postgres:16-alpine
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U postgres"], interval: 5s, retries: 5 }
volumes: { pgdata: {} }
```

- Named volumes for data. `depends_on` with `service_healthy`, not just container start.
- `docker compose up --build` to test the real image locally before pushing.

## Registries and tagging

- Tag immutably: `registry/app:<git-sha>`, plus `latest` as a moving pointer only. Deploy by SHA, never by `latest` in production.
- Scan images (`docker scout`, Trivy) in CI. Rebuild base images regularly — `alpine` patches CVEs fast.

## Don'ts

- Don't `npm install` in the final image. Don't bake secrets into layers (they persist in history even if deleted later). Don't run as root. Don't use `latest` tags in production manifests. Don't store data in container-local disk you expect to survive restarts.

## Faster builds with BuildKit cache mounts

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=cache,target=/root/.npm npm ci
```

- Cache mounts persist package caches across builds without bloating layers. Enable BuildKit: `DOCKER_BUILDKIT=1` (default on modern Docker).
- For compiled languages, mount the compiler cache too (`/root/.cache/go-build`, `~/.cargo`).

## Image size discipline

- Check with `dive` or `docker history`. Targets: Node runtime <150MB, Go static binary <30MB (use `scratch` or `distroless`).
- `distroless`/`scratch` final stages for compiled binaries — no shell, no package manager, minimal attack surface. Keep a `-debug` variant with busybox for troubleshooting.
- Squash only as a last resort; it destroys layer caching.

## Running in production

- Set `restart: unless-stopped` (compose) or proper Deployment replicas (k8s). Never `--restart always` on one-off jobs.
- Log to stdout/stderr only — the platform collects it. Never log to files inside the container.
- Graceful shutdown: handle SIGTERM, `stop_grace_period: 30s` in compose, `terminationGracePeriodSeconds` in k8s. In-flight requests must drain.

## Debugging running containers

- `docker exec -it <container> sh` to inspect a live container (use the `-debug` variant if the final image has no shell).
- `docker logs --tail 100 -f <container>` for streaming logs. `docker stats` for live CPU/memory per container — quick check before reaching for profilers.

# Toko Jojo Cloud POS Demo

SolidJS admin dashboard, Kotlin Android stock app, Tauri + Rust POS, and Express GraphQL API.

## Layout

```
apps/api        Express GraphQL API
apps/web        SolidJS admin dashboard
apps/pos        Tauri + Rust POS
apps/android    Kotlin Android stock app
packages/       shared GraphQL, UI, and config
infra/          podman-compose, Caddy, cloudflared, backup
load/           k6 capacity scenarios
scripts/        development and operations helpers
```

## Status

Early scaffold. Server stack: Node 26 + pnpm, Express 5, GraphQL Yoga 6, Pothos,
Drizzle 0.x, PostgreSQL 18+. No application code yet.

## Specs

Workflow specs live outside the repo at
`~/.config/opencode/specs/tokojojo-cloud-pos-demo/`.
Do not add `docs/`, `specs/`, or `plans/` directories here.

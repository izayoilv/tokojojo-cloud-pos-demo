# TokoJojo Cloud POS Demo

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/izayoilv/tokojojo-cloud-pos-demo/ci.yml?branch=main&label=ci)](https://github.com/izayoilv/tokojojo-cloud-pos-demo/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-26-339933.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-12-f69220.svg)](https://pnpm.io/)
[![Express](https://img.shields.io/badge/express-5-000000.svg)](https://expressjs.com/)
[![GraphQL Yoga](https://img.shields.io/badge/graphql%20yoga-6-e10098.svg)](https://the-guild.dev/graphql/yoga-server)
[![PostgreSQL](https://img.shields.io/badge/postgresql-18-4169e1.svg)](https://www.postgresql.org/)
[![SolidJS](https://img.shields.io/badge/solidjs-1.9-2c4f7c.svg)](https://www.solidjs.com/)
[![Kotlin](https://img.shields.io/badge/kotlin-2.4-7f52ff.svg)](https://kotlinlang.org/)
[![Tauri](https://img.shields.io/badge/tauri-2-24c8db.svg)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/rust-1.100-000000.svg)](https://www.rust-lang.org/)

Cloud POS demo for TokoJojo: a SolidJS admin dashboard, a Kotlin Android stock app, a
Tauri + Rust POS, and an Express GraphQL API.

**This repository is scaffolding only.** The client shells and development tooling are
in place; the API and database schema are the next implementation step.

## Stack

- **API:** Node 26, pnpm, Express 5, GraphQL Yoga 6, Pothos, Drizzle, PostgreSQL 18+
- **Web:** SolidJS 1.9, Vite 8, TanStack Query, `graphql-request`, Kobalte, Tailwind CSS 4
- **Android:** Kotlin 2.4, Compose, Apollo Kotlin, Metro, Room, ML Kit
- **POS:** Tauri 2.12, Rust 1.100, SolidJS, SQLCipher SQLite
- **Tooling:** Proto, pre-commit, GitHub Actions

## Prerequisites

- Node.js 26.13.1 and pnpm 12.21 (pinned through Proto)
- JDK 25 and Android SDK 37 for the Android app
- Rust 1.100.0 (pinned in `rust-toolchain.toml`)
- Tauri Linux dependencies: `webkit2gtk4.1` and `librsvg2` development packages
- Podman and `podman-compose`

## Quick start

```bash
proto install
pnpm install
pre-commit install

podman-compose -f compose.dev.yaml up -d

pnpm dev:web
pnpm dev:pos
(cd apps/android && ./gradlew :app:assembleDebug)
```

The API is not scaffolded yet. `pnpm dev:web` proxies `/graphql` to
`http://localhost:3000`; data calls fail until the API exists.

## Structure

| Path                | Description                               |
| ------------------- | ----------------------------------------- |
| `apps/api/`         | Express + Yoga + Pothos + Drizzle API     |
| `apps/web/`         | SolidJS admin dashboard                   |
| `apps/pos/`         | Tauri + Rust POS                          |
| `apps/android/`     | Kotlin Android stock app                  |
| `packages/graphql/` | Shared schema and codegen                 |
| `packages/ui/`      | Shared SolidJS components                 |
| `packages/config/`  | Shared lint/format/TypeScript config      |
| `infra/`            | Compose, Caddy, Cloudflare Tunnel, backup |
| `load/`             | k6 capacity scenarios                     |
| `scripts/`          | Development and operations helpers        |

## Platform guides

| Area             | Guide                                                      |
| ---------------- | ---------------------------------------------------------- |
| API              | [`apps/api/README.md`](apps/api/README.md)                 |
| Web              | [`apps/web/README.md`](apps/web/README.md)                 |
| POS              | [`apps/pos/README.md`](apps/pos/README.md)                 |
| Android          | [`apps/android/README.md`](apps/android/README.md)         |
| GraphQL contract | [`packages/graphql/README.md`](packages/graphql/README.md) |

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

Tauri and Android checks are documented in their platform guides.

## Development flow

1. Branch from `main`; never push directly to `main`.
2. Keep the shared GraphQL contract in `packages/graphql/`.
3. Run the relevant checks before opening a PR.
4. Open a PR; `ci-gate` must pass and `@izayoilv` must approve.
5. Merge with squash; the branch is deleted automatically.

`main` is protected. Collaborators use PRs only; the required check is `ci-gate`.

## Shared contract

- Pothos is the schema source of truth once the API is scaffolded.
- Export `schema.graphql`; generate TypeScript, Kotlin, and Rust types from it.
- Do not hand-edit generated client models.
- Money is a decimal string on the wire; IDs are UUIDv7 strings.

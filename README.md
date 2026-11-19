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

**This repository is scaffolding only.** The client shells, development tooling, and
Drizzle database schema are in place; the API server is the next implementation step.

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

cp .env.example apps/api/.env
pnpm db:migrate
pnpm db:seed

pnpm dev:web
pnpm dev:pos
(cd apps/android && ./gradlew :app:assembleDebug)
```

The API server is not scaffolded yet. `pnpm dev:web` proxies `/graphql` to
`http://localhost:3000`; data calls fail until the server exists.

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

## Working with issues, Projects, and PRs

`main` is protected. For collaborators, `git push origin main` is rejected. All changes
go through a pull request.

### Why not push directly to main?

| Direct push to `main`           | Pull request                                   |
| ------------------------------- | ---------------------------------------------- |
| No review                       | Code-owner review required                     |
| No CI record                    | `ci-gate` must pass                            |
| Can break the demo for everyone | Main stays green                               |
| No link to a task               | PR links to an issue and the Project board     |
| Hard to audit                   | Commit, checks, review, and merge are recorded |

You can still use ordinary git commands locally. Only the final `git push origin main`
is replaced by pushing a branch and opening a PR.

### Daily flow

1. Pick an issue from the Project board, or create one in the repo **Issues** tab.
2. Create a branch:

   ```bash
   git switch main
   git pull
   git switch -c feat/short-description
   ```

3. Commit with a conventional message:

   ```bash
   git add .
   git commit -m "feat(db): add sales and stock tables"
   ```

4. Push the branch:

   ```bash
   git push -u origin feat/short-description
   ```

5. Open a PR against `main`. Use the PR template.
6. Wait for `ci-gate` and for `@izayoilv` to approve.
7. Squash merge. The branch is deleted automatically.

### Reference the issue

Not required for CI, but required by team convention:

```text
Closes #2
```

- `Closes #2` closes the issue when the PR is merged.
- `Refs #2` links the PR without closing the issue.
- Multiple issues: `Closes #2, #7`.
- If there is no issue, create one first; do not use the PR as the task list.

### CI expectations

- Required check: `ci-gate`.
- `web`, `rust`, and `android` run only when their paths change.
- Docs-only PRs skip the build jobs, but `ci-gate` still runs.
- A failed check is fixed on the same branch; push again and CI reruns.
- A new push after approval dismisses the old approval; request review again.

### Project board

- **Issues** are tasks.
- **Project** is the board and its views.
- Add each new issue to the project with the issue's **Projects** sidebar.
- Keep `Status`, `Area`, and `Priority` up to date.
- Closing the issue through `Closes #...` is the normal way to finish a task.

Project: <https://github.com/users/izayoilv/projects/1>

### Pull request checklist

- [ ] PR title is conventional (`feat:`, `fix:`, `docs:`, `ci:`)
- [ ] Body contains `Closes #...` or `Refs #...`
- [ ] The relevant local checks pass
- [ ] `ci-gate` is green
- [ ] No secrets, tokens, or local database files
- [ ] UI changes include a screenshot or short recording

## Shared contract

- Pothos is the schema source of truth once the API is scaffolded.
- Export `schema.graphql`; generate TypeScript, Kotlin, and Rust types from it.
- Do not hand-edit generated client models.
- Money is a decimal string on the wire; IDs are UUIDv7 strings.

# Tauri + Rust POS

The only client that sells. Tauri shell, SolidJS UI, Rust core.

## Stack

| Layer          | Choice                                         |
| -------------- | ---------------------------------------------- |
| Shell          | Tauri 2.12.x                                   |
| UI             | SolidJS 1.9.x + Vite 8                         |
| Core           | Rust 1.100.0                                   |
| Local database | SQLite + SQLCipher                             |
| Crypto         | Ed25519 device key, PASETO v4.public, Argon2id |
| IDs            | UUIDv7                                         |
| Money          | `rust_decimal`                                 |

## Development

Linux system dependencies:

```
webkit2gtk4.1-devel
librsvg2-devel
glib2-devel
gtk3-devel
openssl-devel
libappindicator-gtk3-devel
libxdo-devel
patchelf
rpm-build
```

```bash
pnpm --filter @tokojojo/pos tauri dev
pnpm --filter @tokojojo/pos build
pnpm --filter @tokojojo/pos typecheck
cargo check --workspace
```

`cargo check` must run in an environment with the system dependencies above. The
current Rust command is `app_info`; it proves the IPC path.

## Architecture

The Rust core owns security and sync:

- login/refresh and PASETO handling;
- device key generation and signing;
- SQLCipher database key and local encrypted storage;
- catalog cache, sales, sale lines, stock movements, outbox;
- health checks and the offline/online state machine.

The webview only calls typed Tauri commands and listens to events. Tokens, refresh
tokens, the device private key, and SQLCipher keys must never enter JavaScript or
plain SQLite.

Planned commands include `login`, `unlock_pin`, `search_products`, `create_sale`,
`sync_now`, `get_sync_status`, and `enroll_device`.

## Offline flow

1. Online-first; every sale is written to local SQLite before the network call.
2. Health checks: 3 failures → OFFLINE; 2 successes → reconnect/sync.
3. Offline token: 7 days, plus 7 days grace; device-scoped.
4. Offline sales are signed and queued; sync is idempotent per order.
5. Grace sales are accepted but flagged.
6. After grace, hard lock; online re-auth is required.
7. Clock checks use last server time + monotonic elapsed; a clock rollback cannot
   extend the offline window.

PIN/password unlocks the local session only. It is not a server credential.
Biometrics are optional; the current target laptop has no biometric sensor.

## Feature flow

1. Add or change the SQLite table and migration.
2. Add the Rust service/command and a typed serializable result.
3. Emit a Tauri event when the UI needs to react to a background change.
4. Call the command from SolidJS and keep the UI free of token/DB logic.
5. Add Rust tests for transactions, signing, expiry, and idempotency.
6. Run the Tauri frontend build and the Rust checks before opening a PR.

## Packaging

`tauri.conf.json` currently uses `"targets": "all"`. That may require `rpm-build`,
`dpkg`, and AppImage tooling. For local Fedora builds, narrow it to `["rpm"]`; add
other targets when the release pipeline needs them.

## Local database

Planned tables: `products`, `product_barcodes`, `sales`, `sale_items`,
`stock_movements`, `outbox`, `users_local`, `settings`, `sync_state`, `audit_log`.

Use WAL, `busy_timeout`, migrations, and `synchronous=FULL` for sale commits. The
SQLCipher key comes from the OS keychain, not from the PIN.

## Before PR

```bash
pnpm --filter @tokojojo/pos typecheck
pnpm --filter @tokojojo/pos build
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo check --workspace
```

Run the Rust commands in an environment with the system dependencies above. Do not
commit tokens, keys, SQLite files, or local databases.

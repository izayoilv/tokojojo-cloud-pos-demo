# Android stock app

Kotlin/JVM Android app for monitoring and barcode stock receiving.

## Scope

- Dashboard monitoring: sales summary, low stock, stock value.
- Stock list/search and product detail.
- Barcode scanning for receiving/adding stock.
- `receiveStock` and `adjustStock` mutations.

This app does **not** sell, does not create offline sales, and does not receive an
offline token. It is online-only. A stock draft may be kept locally and retried, but
that is not an authorization to sell offline.

## Stack

| Layer       | Choice                                                      |
| ----------- | ----------------------------------------------------------- |
| Language    | Kotlin 2.4.x                                                |
| Build       | AGP 9.5.1, Gradle 9.9.1, JDK 25 toolchain, Java 17 bytecode |
| UI          | Compose + Material 3 + Navigation 3                         |
| HTTP        | Apollo Kotlin 5.2 (GraphQL)                                 |
| DI          | Metro 1.6                                                   |
| Local cache | Room 2.8.5                                                  |
| Barcode     | ML Kit 17.3 bundled + CameraX                               |
| Auth        | PASETO v4.public + opaque refresh                           |

The version catalog already contains Apollo, Metro, Room, ML Kit, and CameraX. The
current app module is a minimal Compose shell; apply each plugin/dependency when its
feature lands.

## Commands

```bash
cd apps/android
./gradlew :app:assembleDebug
./gradlew :app:lintDebug
./gradlew :app:testDebugUnitTest
```

SDK 37 and JDK 25 are required. The app targets Java 17 bytecode. CI uses the same
combination.

## Feature flow

1. Add the GraphQL operation to `packages/graphql/operations`.
2. Generate Apollo Kotlin models when the schema exists.
3. Add a repository method; keep network DTOs out of Compose.
4. Expose UI state through a ViewModel and `StateFlow`.
5. Use Room only for cache/drafts, not for authorization.
6. Add a unit test for repository/error mapping and a Compose test for the screen.
7. Run assembleDebug and lint before opening a PR.

## Barcode flow

1. CameraX preview + ML Kit bundled scanner.
2. Debounce duplicate scans.
3. Look up product by barcode/SKU.
4. Enter quantity, supplier, and reference.
5. Save a local draft; submit `receiveStock` when online.
6. Retry on foreground or explicit action. No background WorkManager yet.

## Security

- Refresh token belongs in Android Keystore/StrongBox.
- Biometric unlock is optional via `BiometricPrompt`; PIN/password is the fallback.
- Never store tokens in plain SharedPreferences or logs.
- Server enforces roles; UI hiding is not authorization.
- No `sales:create` scope is issued to this client.

## Before PR

```bash
cd apps/android
./gradlew :app:assembleDebug --no-daemon
./gradlew :app:lintDebug --no-daemon
```

Also run the repository pre-commit hooks; Kotlin formatting is enforced there.

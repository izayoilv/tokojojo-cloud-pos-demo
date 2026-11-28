import { getSqlClient } from "./repository.ts";

export interface AuthCleanupOptions {
  now?: Date;
  nonceRetentionMs?: number;
  sessionRetentionMs?: number;
  refreshRetentionMs?: number;
  offlineRetentionMs?: number;
}

export interface AuthCleanupResult {
  nonces: number;
  sessions: number;
  refreshTokens: number;
  offlineTokens: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function envDuration(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const value = Number(env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function authCleanupOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Required<Omit<AuthCleanupOptions, "now">> {
  return {
    nonceRetentionMs: envDuration(
      env,
      "AUTH_CLEANUP_NONCE_RETENTION_MS",
      HOUR_MS,
    ),
    sessionRetentionMs: envDuration(
      env,
      "AUTH_CLEANUP_SESSION_RETENTION_MS",
      7 * DAY_MS,
    ),
    refreshRetentionMs: envDuration(
      env,
      "AUTH_CLEANUP_REFRESH_RETENTION_MS",
      7 * DAY_MS,
    ),
    offlineRetentionMs: envDuration(
      env,
      "AUTH_CLEANUP_OFFLINE_RETENTION_MS",
      7 * DAY_MS,
    ),
  };
}

function resolveOptions(options: AuthCleanupOptions): {
  now: Date;
  nonceRetentionMs: number;
  sessionRetentionMs: number;
  refreshRetentionMs: number;
  offlineRetentionMs: number;
} {
  const defaults = authCleanupOptionsFromEnv();
  return {
    now: options.now ?? new Date(),
    nonceRetentionMs: options.nonceRetentionMs ?? defaults.nonceRetentionMs,
    sessionRetentionMs:
      options.sessionRetentionMs ?? defaults.sessionRetentionMs,
    refreshRetentionMs:
      options.refreshRetentionMs ?? defaults.refreshRetentionMs,
    offlineRetentionMs:
      options.offlineRetentionMs ?? defaults.offlineRetentionMs,
  };
}

/**
 * Deletes auth artifacts after their retention window. Refresh-token families
 * stay intact while any member is still inside the reuse-detection window;
 * offline tokens are retained through grace plus the configured grace period.
 */
export async function purgeExpiredAuthArtifacts(
  options: AuthCleanupOptions = {},
): Promise<AuthCleanupResult> {
  const resolved = resolveOptions(options);
  const now = resolved.now;
  const client = await getSqlClient();

  return client.begin(async (transaction) => {
    const nonceCutoff = new Date(
      now.getTime() - resolved.nonceRetentionMs,
    ).toISOString();
    const sessionCutoff = new Date(
      now.getTime() - resolved.sessionRetentionMs,
    ).toISOString();
    const refreshCutoff = new Date(
      now.getTime() - resolved.refreshRetentionMs,
    ).toISOString();
    const offlineCutoff = new Date(
      now.getTime() - resolved.offlineRetentionMs,
    ).toISOString();

    const nonces = await transaction`
      delete from auth_nonces
      where expires_at <= ${nonceCutoff}::timestamptz
         or (used_at is not null and used_at <= ${nonceCutoff}::timestamptz)
      returning id`;
    const sessions = await transaction`
      delete from sessions
      where expires_at <= ${sessionCutoff}::timestamptz
         or (revoked_at is not null and revoked_at <= ${sessionCutoff}::timestamptz)
      returning id`;
    const refreshTokens = await transaction`
      delete from refresh_tokens rt
      where (
        rt.expires_at <= ${refreshCutoff}::timestamptz
        or (rt.revoked_at is not null and rt.revoked_at <= ${refreshCutoff}::timestamptz)
      )
      and not exists (
        select 1 from refresh_tokens family
        where family.family_id = rt.family_id
          and family.expires_at > ${refreshCutoff}::timestamptz
      )
      returning rt.id`;
    const offlineTokens = await transaction`
      delete from offline_tokens
      where grace_until <= ${offlineCutoff}::timestamptz
      returning jti`;

    return {
      nonces: nonces.length,
      sessions: sessions.length,
      refreshTokens: refreshTokens.length,
      offlineTokens: offlineTokens.length,
    };
  });
}

export function startAuthCleanupJob(
  options: AuthCleanupOptions & { intervalMs?: number } = {},
): () => void {
  const intervalMs =
    options.intervalMs ??
    envDuration(process.env, "AUTH_CLEANUP_INTERVAL_MS", 24 * HOUR_MS);
  const run = (): void => {
    void purgeExpiredAuthArtifacts(options).catch((error: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          message: "auth_cleanup_failed",
          errorName: error instanceof Error ? error.name : typeof error,
        }),
      );
    });
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";

import { purgeExpiredAuthArtifacts } from "../src/auth/cleanup.ts";
import { testSql } from "./db.ts";

const sharedSql = await import("../src/db/client.ts").then(
  (module) => module.sql,
);

after(async () => {
  await Promise.all([testSql.end(), sharedSql.end({ timeout: 5 })]);
});

test("auth cleanup removes expired artifacts and keeps live windows", async () => {
  const suffix = randomUUID();
  const now = new Date();
  const old = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const [user] = await testSql`
    insert into users (name, username, password_hash, role)
    values (
      ${`Cleanup ${suffix}`}, ${`cleanup-${suffix}`}, 'x', 'OWNER'
    )
    returning id`;
  const [device] = await testSql`
    insert into devices (
      name, platform, enrolled_by_user_id, status, enrolled_at
    )
    values (
      ${`Cleanup device ${suffix}`}, 'ANDROID', ${user.id}, 'ACTIVE', now()
    )
    returning id`;

  const nonceExpired = randomUUID();
  const nonceUsed = randomUUID();
  const nonceLive = randomUUID();
  await testSql`
    insert into auth_nonces (
      nonce_hash, device_id, expires_at, created_at
    )
    values (
      ${nonceExpired}, ${device.id}, ${old.toISOString()}::timestamptz,
      ${new Date(old.getTime() - 60_000).toISOString()}::timestamptz
    )`;
  await testSql`
    insert into auth_nonces (
      nonce_hash, device_id, expires_at, used_at, created_at
    )
    values (
      ${nonceUsed}, ${device.id}, ${future.toISOString()}::timestamptz,
      ${old.toISOString()}::timestamptz,
      ${new Date(old.getTime() - 60_000).toISOString()}::timestamptz
    )`;
  await testSql`
    insert into auth_nonces (
      nonce_hash, device_id, expires_at
    )
    values (${nonceLive}, ${device.id}, ${future.toISOString()}::timestamptz)`;

  const sessionExpired = randomUUID();
  const sessionRevoked = randomUUID();
  const sessionLive = randomUUID();
  await testSql`
    insert into sessions (
      user_id, token_hash, csrf_token_hash, expires_at, created_at
    )
    values (
      ${user.id}, ${sessionExpired}, ${randomUUID()},
      ${old.toISOString()}::timestamptz,
      ${new Date(old.getTime() - 60_000).toISOString()}::timestamptz
    )`;
  await testSql`
    insert into sessions (
      user_id, token_hash, csrf_token_hash, expires_at, revoked_at, created_at
    )
    values (
      ${user.id}, ${sessionRevoked}, ${randomUUID()},
      ${future.toISOString()}::timestamptz, ${old.toISOString()}::timestamptz,
      ${new Date(old.getTime() - 60_000).toISOString()}::timestamptz
    )`;
  await testSql`
    insert into sessions (
      user_id, token_hash, csrf_token_hash, expires_at
    )
    values (${user.id}, ${sessionLive}, ${randomUUID()}, ${future.toISOString()}::timestamptz)`;

  const familyLive = randomUUID();
  const rotatedLiveFamily = randomUUID();
  const liveFamilyToken = randomUUID();
  const familyExpired = randomUUID();
  const expiredRotated = randomUUID();
  await testSql`
    insert into refresh_tokens (
      device_id, token_hash, family_id, expires_at, rotated_at, created_at
    )
    values (
      ${device.id}, ${rotatedLiveFamily}, ${familyLive},
      ${old.toISOString()}::timestamptz, ${old.toISOString()}::timestamptz,
      ${old.toISOString()}::timestamptz
    )`;
  await testSql`
    insert into refresh_tokens (
      device_id, token_hash, family_id, expires_at
    )
    values (
      ${device.id}, ${liveFamilyToken}, ${familyLive},
      ${future.toISOString()}::timestamptz
    )`;
  await testSql`
    insert into refresh_tokens (
      device_id, token_hash, family_id, expires_at, rotated_at, created_at
    )
    values (
      ${device.id}, ${expiredRotated}, ${familyExpired},
      ${old.toISOString()}::timestamptz, ${old.toISOString()}::timestamptz,
      ${old.toISOString()}::timestamptz
    )`;

  const offlineGraceLive = randomUUID();
  const offlineExpired = randomUUID();
  await testSql`
    insert into offline_tokens (
      jti, device_id, issued_to_user_id, scope, issued_at, expires_at,
      grace_until
    )
    values (
      ${offlineGraceLive}, ${device.id}, ${user.id},
      '{sales:create}', ${old.toISOString()}::timestamptz,
      ${old.toISOString()}::timestamptz, ${future.toISOString()}::timestamptz
    )`;
  await testSql`
    insert into offline_tokens (
      jti, device_id, issued_to_user_id, scope, issued_at, expires_at,
      grace_until
    )
    values (
      ${offlineExpired}, ${device.id}, ${user.id},
      '{sales:create}', ${new Date(old.getTime() - 60_000).toISOString()}::timestamptz,
      ${old.toISOString()}::timestamptz,
      ${new Date(old.getTime() + 30 * 60 * 1000).toISOString()}::timestamptz
    )`;

  const purged = await purgeExpiredAuthArtifacts({
    now,
    nonceRetentionMs: 0,
    sessionRetentionMs: 0,
    refreshRetentionMs: 0,
    offlineRetentionMs: 0,
  });
  assert.ok(purged.nonces >= 2);
  assert.ok(purged.sessions >= 2);
  assert.ok(purged.refreshTokens >= 1);
  assert.ok(purged.offlineTokens >= 1);

  const remainingNonces = (await testSql`
    select nonce_hash from auth_nonces
    where nonce_hash in (${nonceExpired}, ${nonceUsed}, ${nonceLive})`) as Array<{
    nonce_hash: string;
  }>;
  assert.deepEqual(
    remainingNonces.map((row) => row.nonce_hash),
    [nonceLive],
  );

  const remainingSessions = (await testSql`
    select token_hash from sessions
    where token_hash in (${sessionExpired}, ${sessionRevoked}, ${sessionLive})`) as Array<{
    token_hash: string;
  }>;
  assert.deepEqual(
    remainingSessions.map((row) => row.token_hash),
    [sessionLive],
  );

  const remainingRefresh = (await testSql`
    select token_hash from refresh_tokens
    where token_hash in (
      ${rotatedLiveFamily}, ${liveFamilyToken}, ${expiredRotated}
    )`) as Array<{ token_hash: string }>;
  assert.deepEqual(
    new Set(remainingRefresh.map((row) => row.token_hash)),
    new Set([rotatedLiveFamily, liveFamilyToken]),
  );

  const remainingOffline = (await testSql`
    select jti::text from offline_tokens
    where jti in (${offlineGraceLive}, ${offlineExpired})`) as Array<{
    jti: string;
  }>;
  assert.deepEqual(
    remainingOffline.map((row) => row.jti),
    [offlineGraceLive],
  );
});

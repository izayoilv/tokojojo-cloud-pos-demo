import assert from "node:assert/strict";
import { after, test } from "node:test";

import { randomSuffix, testSql } from "./db.ts";

after(() => testSql.end());

async function createDevice(): Promise<string> {
  const suffix = randomSuffix();
  const [user] = await testSql`
    insert into users (name, username, password_hash, role)
    values (${`User ${suffix}`}, ${`user-${suffix}`}, 'hash', 'ADMIN')
    returning id`;
  const [device] = await testSql`
    insert into devices (name, platform, enrolled_by_user_id, status)
    values (${`Device ${suffix}`}, 'TAURI', ${user.id}, 'PENDING')
    returning id`;
  return device.id;
}

test("auth_nonces are unique per hash and expire after creation", async () => {
  const deviceId = await createDevice();
  const nonceHash = `nonce-${randomSuffix()}`;
  const expiresAt = new Date(Date.now() + 60_000);

  await testSql`
    insert into auth_nonces (nonce_hash, device_id, expires_at)
    values (${nonceHash}, ${deviceId}, ${expiresAt})`;

  await assert.rejects(
    testSql`
      insert into auth_nonces (nonce_hash, device_id, expires_at)
      values (${nonceHash}, ${deviceId}, ${expiresAt})`,
    (error: unknown) => {
      const pgError = error as {
        constraint?: string;
        constraint_name?: string;
      };
      return (
        (pgError.constraint ?? pgError.constraint_name) ===
        "auth_nonces_nonce_hash_unique"
      );
    },
  );

  await assert.rejects(
    testSql`
      insert into auth_nonces (nonce_hash, device_id, expires_at)
      values (
        ${`nonce-${randomSuffix()}`}, ${deviceId},
        ${new Date(Date.now() - 60_000)}
      )`,
    (error: unknown) => {
      const pgError = error as {
        constraint?: string;
        constraint_name?: string;
      };
      return (
        (pgError.constraint ?? pgError.constraint_name) ===
        "auth_nonces_expires_after_created"
      );
    },
  );
});

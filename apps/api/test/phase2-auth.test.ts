import assert from "node:assert/strict";
import { after, test } from "node:test";

import { randomSuffix, testSql } from "./db.ts";

after(() => testSql.end());

async function expectPgError(
  promise: Promise<unknown>,
  code: string,
  constraint?: string,
  column?: string,
) {
  await assert.rejects(promise, (error: unknown) => {
    const pgError = error as {
      code?: string;
      constraint?: string;
      constraint_name?: string;
      column?: string;
      column_name?: string;
    };
    assert.equal(pgError.code, code);
    if (constraint !== undefined) {
      assert.equal(pgError.constraint ?? pgError.constraint_name, constraint);
    }
    if (column !== undefined) {
      assert.equal(pgError.column ?? pgError.column_name, column);
    }
    return true;
  });
}

async function createUser(): Promise<string> {
  const suffix = randomSuffix();
  const [user] = await testSql`
    insert into users (name, username, password_hash, role)
    values (${`Cashier ${suffix}`}, ${`cashier-${suffix}`}, 'hash', 'CASHIER')
    returning id`;
  return user.id;
}

type DeviceOptions = {
  name?: string;
  platform?: string;
  status?: string;
  enrolledAt?: Date | null;
  revokedAt?: Date | null;
};

async function createDevice(userId: string, options: DeviceOptions = {}) {
  const [device] = await testSql`
    insert into devices (
      name, platform, enrolled_by_user_id, status, enrolled_at, revoked_at
    )
    values (
      ${options.name ?? `Terminal ${randomSuffix()}`},
      ${options.platform ?? "TAURI"},
      ${userId},
      ${options.status ?? "PENDING"},
      ${options.enrolledAt ?? null},
      ${options.revokedAt ?? null}
    )
    returning id, status, platform`;
  return device;
}

type DeviceKeyOptions = {
  keyId?: string;
  publicKey?: string;
  status?: string;
  activatedAt?: Date | null;
  retiredAt?: Date | null;
  acceptedUntil?: Date | null;
  revokedAt?: Date | null;
};

async function createDeviceKey(
  deviceId: string,
  options: DeviceKeyOptions = {},
) {
  const [key] = await testSql`
    insert into device_keys (
      device_id, key_id, public_key, status,
      activated_at, retired_at, accepted_until, revoked_at
    )
    values (
      ${deviceId},
      ${options.keyId ?? `kid-${randomSuffix()}`},
      ${options.publicKey ?? `pub-${randomSuffix()}`},
      ${options.status ?? "ACTIVE"},
      ${options.activatedAt ?? null},
      ${options.retiredAt ?? null},
      ${options.acceptedUntil ?? null},
      ${options.revokedAt ?? null}
    )
    returning id, key_id, status`;
  return key;
}

async function createOfflineShift(
  userId: string,
  deviceId: string,
): Promise<string> {
  const [shift] = await testSql`
    insert into cashier_shifts (user_id, device_id, source, opened_at_client)
    values (${userId}, ${deviceId}, 'OFFLINE', now())
    returning id`;
  return shift.id;
}

type SaleOptions = {
  source?: string;
  deviceId?: string | null;
  clientOrderId?: string | null;
  clientSeq?: number | null;
  clientCreatedAt?: Date | null;
  syncBatchId?: string | null;
};

async function createSale(
  shiftId: string,
  userId: string,
  options: SaleOptions = {},
) {
  const [sale] = await testSql`
    insert into sales (
      invoice_no, shift_id, user_id, subtotal, total_amount, settlement_method,
      source, device_id, client_order_id, client_seq, client_created_at,
      sync_batch_id
    )
    values (
      ${`INV-${randomSuffix()}`}, ${shiftId}, ${userId}, 5000, 5000, 'CASH',
      ${options.source ?? "ONLINE"},
      ${options.deviceId ?? null},
      ${options.clientOrderId ?? null},
      ${options.clientSeq ?? null},
      ${options.clientCreatedAt ?? null},
      ${options.syncBatchId ?? null}
    )
    returning id, source`;
  return sale;
}

function offlineSaleOptions(deviceId: string): SaleOptions {
  return {
    source: "OFFLINE",
    deviceId,
    clientOrderId: crypto.randomUUID(),
    clientSeq: 1,
    clientCreatedAt: new Date(),
  };
}

test("users default credential fields and reject non-positive versions", async () => {
  const userId = await createUser();
  const [row] = await testSql`
    select password_pepper_version, credential_version, password_changed_at
    from users where id = ${userId}`;
  assert.equal(Number(row.password_pepper_version), 1);
  assert.equal(Number(row.credential_version), 1);
  assert.ok(row.password_changed_at instanceof Date);

  await expectPgError(
    testSql`
      insert into users (name, username, password_hash, role, password_pepper_version)
      values ('Zero Pepper', ${`zero-${randomSuffix()}`}, 'hash', 'CASHIER', 0)`,
    "23514",
    "users_password_pepper_version_positive",
  );

  await expectPgError(
    testSql`
      update users set credential_version = -1 where id = ${userId}`,
    "23514",
    "users_credential_version_positive",
  );
});

test("sessions store token hashes and enforce uniqueness and expiry", async () => {
  const userId = await createUser();
  const tokenHash = `sess-${randomSuffix()}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const [session] = await testSql`
    insert into sessions (user_id, token_hash, csrf_token_hash, expires_at)
    values (${userId}, ${tokenHash}, ${`csrf-${randomSuffix()}`}, ${expiresAt})
    returning id, created_at, last_seen_at, revoked_at`;
  assert.ok(session.created_at instanceof Date);
  assert.equal(session.last_seen_at, null);
  assert.equal(session.revoked_at, null);

  await expectPgError(
    testSql`
      insert into sessions (user_id, token_hash, csrf_token_hash, expires_at)
      values (${userId}, ${tokenHash}, ${`csrf-${randomSuffix()}`}, ${expiresAt})`,
    "23505",
    "sessions_token_hash_unique",
  );

  await expectPgError(
    testSql`
      insert into sessions (user_id, token_hash, expires_at)
      values (${userId}, ${`sess-${randomSuffix()}`}, ${expiresAt})`,
    "23502",
    undefined,
    "csrf_token_hash",
  );

  await expectPgError(
    testSql`
      insert into sessions (user_id, token_hash, csrf_token_hash)
      values (${userId}, ${`sess-${randomSuffix()}`}, 'csrf')`,
    "23502",
    undefined,
    "expires_at",
  );

  await expectPgError(
    testSql`
      insert into sessions (user_id, token_hash, csrf_token_hash, expires_at)
      values (${userId}, ${`sess-${randomSuffix()}`}, 'csrf', now() - interval '1 hour')`,
    "23514",
    "sessions_expires_after_created",
  );

  await expectPgError(
    testSql`
      insert into sessions (user_id, token_hash, csrf_token_hash, expires_at)
      values (${crypto.randomUUID()}, ${`sess-${randomSuffix()}`}, 'csrf', ${expiresAt})`,
    "23503",
    "sessions_user_id_users_id_fk",
  );
});

test("devices accept both platforms and enforce lifecycle fields", async () => {
  const userId = await createUser();

  const android = await createDevice(userId, { platform: "ANDROID" });
  assert.equal(android.platform, "ANDROID");
  assert.equal(android.status, "PENDING");

  const tauri = await createDevice(userId, {
    platform: "TAURI",
    status: "ACTIVE",
    enrolledAt: new Date(),
  });
  assert.equal(tauri.platform, "TAURI");
  assert.equal(tauri.status, "ACTIVE");

  await expectPgError(
    createDevice(userId, { name: "   " }),
    "23514",
    "devices_name_not_blank",
  );

  await expectPgError(
    createDevice(userId, { status: "REVOKED" }),
    "23514",
    "devices_revoked_fields_consistent",
  );

  await expectPgError(
    createDevice(userId, { status: "PENDING", revokedAt: new Date() }),
    "23514",
    "devices_revoked_fields_consistent",
  );

  const revoked = await createDevice(userId, {
    status: "REVOKED",
    revokedAt: new Date(),
  });
  assert.equal(revoked.status, "REVOKED");

  await expectPgError(
    createDevice(userId, { status: "ACTIVE" }),
    "23514",
    "devices_active_requires_enrolled",
  );
});

test("device_keys allow one ACTIVE key per device and consistent rotation", async () => {
  const userId = await createUser();
  const device = await createDevice(userId, {
    status: "ACTIVE",
    enrolledAt: new Date(),
  });

  const active = await createDeviceKey(device.id, { activatedAt: new Date() });
  assert.equal(active.status, "ACTIVE");

  const otherDevice = await createDevice(userId);
  await expectPgError(
    createDeviceKey(otherDevice.id, { keyId: active.key_id }),
    "23505",
    "device_keys_key_id_unique",
  );

  await expectPgError(
    createDeviceKey(device.id),
    "23505",
    "device_keys_one_active_per_device",
  );

  await expectPgError(
    createDeviceKey(device.id, {
      status: "RETIRED",
      acceptedUntil: new Date(),
    }),
    "23514",
    "device_keys_status_fields_consistent",
  );

  await expectPgError(
    createDeviceKey(device.id, { status: "RETIRED", retiredAt: new Date() }),
    "23514",
    "device_keys_status_fields_consistent",
  );

  const retiredAt = new Date();
  const acceptedUntil = new Date(
    retiredAt.getTime() + 14 * 24 * 60 * 60 * 1000,
  );
  await testSql`
    update device_keys
    set status = 'RETIRED', retired_at = ${retiredAt}, accepted_until = ${acceptedUntil}
    where id = ${active.id}`;

  const replacement = await createDeviceKey(device.id, {
    activatedAt: new Date(),
  });
  assert.equal(replacement.status, "ACTIVE");

  await expectPgError(
    createDeviceKey(device.id, {
      status: "RETIRED",
      retiredAt,
      acceptedUntil: retiredAt,
    }),
    "23514",
    "device_keys_accepted_until_after_retired",
  );

  await expectPgError(
    createDeviceKey(device.id, { status: "REVOKED" }),
    "23514",
    "device_keys_status_fields_consistent",
  );

  const revoked = await createDeviceKey(device.id, {
    status: "REVOKED",
    revokedAt: new Date(),
  });
  assert.equal(revoked.status, "REVOKED");

  await expectPgError(
    createDeviceKey(device.id, { keyId: "   " }),
    "23514",
    "device_keys_key_id_not_blank",
  );

  await expectPgError(
    createDeviceKey(device.id, { publicKey: "   " }),
    "23514",
    "device_keys_public_key_not_blank",
  );
});

test("refresh_tokens store unique hashes with rotation metadata", async () => {
  const userId = await createUser();
  const device = await createDevice(userId);
  const tokenHash = `refresh-${randomSuffix()}`;
  const familyId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const [token] = await testSql`
    insert into refresh_tokens (device_id, token_hash, family_id, expires_at)
    values (${device.id}, ${tokenHash}, ${familyId}, ${expiresAt})
    returning id, family_id, rotated_at, revoked_at, created_at`;
  assert.equal(token.family_id, familyId);
  assert.equal(token.rotated_at, null);
  assert.equal(token.revoked_at, null);
  assert.ok(token.created_at instanceof Date);

  await expectPgError(
    testSql`
      insert into refresh_tokens (device_id, token_hash, family_id, expires_at)
      values (${device.id}, ${tokenHash}, ${crypto.randomUUID()}, ${expiresAt})`,
    "23505",
    "refresh_tokens_token_hash_unique",
  );
});

test("offline_tokens enforce scope and the grace window", async () => {
  const userId = await createUser();
  const device = await createDevice(userId);
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const graceUntil = new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const scope = ["sales:create", "catalog:read", "inventory:read"];

  const [token] = await testSql`
    insert into offline_tokens (
      jti, device_id, issued_to_user_id, scope, expires_at, grace_until
    )
    values (${jti}, ${device.id}, ${userId}, ${scope}, ${expiresAt}, ${graceUntil})
    returning jti, scope, issued_at, rotated_at, revoked_at`;
  assert.equal(token.jti, jti);
  assert.deepEqual(token.scope, scope);
  assert.ok(token.issued_at instanceof Date);
  assert.equal(token.rotated_at, null);
  assert.equal(token.revoked_at, null);

  await expectPgError(
    testSql`
      insert into offline_tokens (
        jti, device_id, issued_to_user_id, scope, expires_at, grace_until
      )
      values (
        ${crypto.randomUUID()}, ${device.id}, ${userId}, ${scope},
        ${expiresAt}, ${expiresAt}
      )`,
    "23514",
    "offline_tokens_grace_after_expiry",
  );

  await expectPgError(
    testSql`
      insert into offline_tokens (
        jti, device_id, issued_to_user_id, scope, expires_at, grace_until
      )
      values (
        ${crypto.randomUUID()}, ${device.id}, ${userId}, ${scope},
        ${expiresAt}, ${new Date(expiresAt.getTime() - 1000)}
      )`,
    "23514",
    "offline_tokens_grace_after_expiry",
  );

  await expectPgError(
    testSql`
      insert into offline_tokens (
        jti, device_id, issued_to_user_id, scope, expires_at, grace_until
      )
      values (
        ${crypto.randomUUID()}, ${device.id}, ${userId}, '{}'::text[],
        ${expiresAt}, ${graceUntil}
      )`,
    "23514",
    "offline_tokens_scope_non_empty",
  );

  await expectPgError(
    testSql`
      insert into offline_tokens (
        jti, device_id, issued_to_user_id, scope, expires_at, grace_until
      )
      values (${jti}, ${device.id}, ${userId}, ${scope}, ${expiresAt}, ${graceUntil})`,
    "23505",
    "offline_tokens_pkey",
  );
});

test("cashier_shifts require client fields for offline shifts", async () => {
  const userId = await createUser();
  const device = await createDevice(userId, {
    status: "ACTIVE",
    enrolledAt: new Date(),
  });

  const [online] = await testSql`
    insert into cashier_shifts (user_id)
    values (${userId})
    returning id, source, device_id, opened_at_client, received_at`;
  assert.equal(online.source, "ONLINE");
  assert.equal(online.device_id, null);
  assert.equal(online.opened_at_client, null);
  assert.ok(online.received_at instanceof Date);

  await testSql`
    update cashier_shifts
    set status = 'CLOSED', closed_at = now(), expected_cash = 0, actual_cash = 0
    where id = ${online.id}`;

  await expectPgError(
    testSql`
      insert into cashier_shifts (user_id, source, opened_at_client)
      values (${userId}, 'OFFLINE', now())`,
    "23514",
    "cashier_shifts_offline_fields_required",
  );

  await expectPgError(
    testSql`
      insert into cashier_shifts (user_id, source, device_id)
      values (${userId}, 'OFFLINE', ${device.id})`,
    "23514",
    "cashier_shifts_offline_fields_required",
  );

  const offlineShiftId = await createOfflineShift(userId, device.id);

  await expectPgError(
    testSql`
      update cashier_shifts
      set status = 'CLOSED', closed_at = now(), expected_cash = 5000, actual_cash = 5000
      where id = ${offlineShiftId}`,
    "23514",
    "cashier_shifts_offline_close_requires_client",
  );

  const [closed] = await testSql`
    update cashier_shifts
    set status = 'CLOSED',
        closed_at = now(),
        closed_at_client = now(),
        expected_cash = 5000,
        actual_cash = 5000
    where id = ${offlineShiftId}
    returning status, closed_at_client, source`;
  assert.equal(closed.status, "CLOSED");
  assert.ok(closed.closed_at_client instanceof Date);
  assert.equal(closed.source, "OFFLINE");

  const secondUserId = await createUser();
  await createOfflineShift(secondUserId, device.id);
  await expectPgError(
    createOfflineShift(secondUserId, device.id),
    "23505",
    "cashier_shifts_open_per_user_unique",
  );
});

test("sales require client identity for offline and grace sources", async () => {
  const userId = await createUser();
  const device = await createDevice(userId, {
    status: "ACTIVE",
    enrolledAt: new Date(),
  });
  const shiftId = await createOfflineShift(userId, device.id);

  const [online] = await testSql`
    insert into sales (invoice_no, shift_id, user_id, subtotal, total_amount, settlement_method)
    values (${`INV-${randomSuffix()}`}, ${shiftId}, ${userId}, 5000, 5000, 'CASH')
    returning source, device_id, client_order_id, client_seq, client_created_at,
              received_at, signature_verified, price_variance, sync_batch_id`;
  assert.equal(online.source, "ONLINE");
  assert.equal(online.device_id, null);
  assert.equal(online.client_order_id, null);
  assert.equal(online.client_seq, null);
  assert.equal(online.client_created_at, null);
  assert.ok(online.received_at instanceof Date);
  assert.equal(online.signature_verified, false);
  assert.equal(Number(online.price_variance), 0);
  assert.equal(online.sync_batch_id, null);

  await expectPgError(
    createSale(shiftId, userId, {
      clientOrderId: crypto.randomUUID(),
    }),
    "23514",
    "sales_client_order_requires_device",
  );

  const required = offlineSaleOptions(device.id);
  for (const missing of [
    "deviceId",
    "clientOrderId",
    "clientSeq",
    "clientCreatedAt",
  ] as const) {
    const constraint =
      missing === "deviceId"
        ? "sales_client_order_requires_device"
        : "sales_offline_fields_required";
    await expectPgError(
      createSale(shiftId, userId, { ...required, [missing]: null }),
      "23514",
      constraint,
    );
  }

  await expectPgError(
    createSale(shiftId, userId, {
      ...required,
      source: "GRACE",
      clientSeq: null,
    }),
    "23514",
    "sales_offline_fields_required",
  );

  const offline = await createSale(shiftId, userId, {
    ...required,
    clientSeq: 0,
  });
  assert.equal(offline.source, "OFFLINE");

  await expectPgError(
    createSale(shiftId, userId, {
      ...required,
      clientOrderId: required.clientOrderId,
    }),
    "23505",
    "sales_device_client_order_unique",
  );

  const otherDevice = await createDevice(userId);
  await testSql`
    update cashier_shifts
    set status = 'CLOSED',
        closed_at = now(),
        closed_at_client = now(),
        expected_cash = 5000,
        actual_cash = 5000
    where id = ${shiftId}`;
  const otherShiftId = await createOfflineShift(userId, otherDevice.id);
  const crossDevice = await createSale(otherShiftId, userId, {
    ...required,
    deviceId: otherDevice.id,
    clientOrderId: required.clientOrderId,
  });
  assert.equal(crossDevice.source, "OFFLINE");

  await expectPgError(
    createSale(shiftId, userId, { ...required, clientSeq: -1 }),
    "23514",
    "sales_client_seq_non_negative",
  );

  await expectPgError(
    createSale(shiftId, userId, {
      ...required,
      clientOrderId: crypto.randomUUID(),
      syncBatchId: crypto.randomUUID(),
    }),
    "23503",
    "sales_sync_batch_id_sync_batches_id_fk",
  );
});

test("sales link to sync batches with RESTRICT deletes", async () => {
  const userId = await createUser();
  const device = await createDevice(userId, {
    status: "ACTIVE",
    enrolledAt: new Date(),
  });
  const shiftId = await createOfflineShift(userId, device.id);
  const clientBatchId = crypto.randomUUID();

  const [batch] = await testSql`
    insert into sync_batches (device_id, client_batch_id, batch_hash)
    values (${device.id}, ${clientBatchId}, ${`hash-${randomSuffix()}`})
    returning id`;
  const sale = await createSale(shiftId, userId, {
    ...offlineSaleOptions(device.id),
    syncBatchId: batch.id,
  });

  await expectPgError(
    testSql`delete from sync_batches where id = ${batch.id}`,
    "23001",
    "sales_sync_batch_id_sync_batches_id_fk",
  );

  const [row] = await testSql`
    select sync_batch_id from sales where id = ${sale.id}`;
  assert.equal(row.sync_batch_id, batch.id);
});

test("sync_batches are idempotent per device with non-negative counts", async () => {
  const userId = await createUser();
  const device = await createDevice(userId);
  const clientBatchId = crypto.randomUUID();

  const [batch] = await testSql`
    insert into sync_batches (device_id, client_batch_id, batch_hash)
    values (${device.id}, ${clientBatchId}, 'hash-a')
    returning accepted_count, flagged_count, rejected_count, received_at`;
  assert.equal(Number(batch.accepted_count), 0);
  assert.equal(Number(batch.flagged_count), 0);
  assert.equal(Number(batch.rejected_count), 0);
  assert.ok(batch.received_at instanceof Date);

  await expectPgError(
    testSql`
      insert into sync_batches (device_id, client_batch_id, batch_hash)
      values (${device.id}, ${clientBatchId}, 'hash-b')`,
    "23505",
    "sync_batches_device_client_batch_unique",
  );

  const otherDevice = await createDevice(userId);
  await testSql`
    insert into sync_batches (device_id, client_batch_id, batch_hash)
    values (${otherDevice.id}, ${clientBatchId}, 'hash-c')`;

  for (const column of ["accepted_count", "flagged_count", "rejected_count"]) {
    await expectPgError(
      testSql`
        insert into sync_batches (device_id, client_batch_id, batch_hash, ${testSql(column)})
        values (${device.id}, ${crypto.randomUUID()}, 'hash-d', -1)`,
      "23514",
      "sync_batches_counts_non_negative",
    );
  }
});

test("device_events and audit_events accept defaults with required retention", async () => {
  const userId = await createUser();
  const device = await createDevice(userId);

  const [event] = await testSql`
    insert into device_events (device_id, type)
    values (${device.id}, 'DEVICE_ENROLLED')
    returning metadata, created_at, actor_user_id`;
  assert.deepEqual(event.metadata, {});
  assert.ok(event.created_at instanceof Date);
  assert.equal(event.actor_user_id, null);

  await expectPgError(
    testSql`
      insert into audit_events (event_type)
      values ('AUTH_LOGIN_SUCCEEDED')`,
    "23502",
    undefined,
    "retention_until",
  );

  const [audit] = await testSql`
    insert into audit_events (event_type, actor_user_id, device_id, retention_until)
    values (
      'SYNC_COMPLETED', ${userId}, ${device.id}, now() + interval '180 days'
    )
    returning metadata, created_at, entity_type, entity_id`;
  assert.deepEqual(audit.metadata, {});
  assert.ok(audit.created_at instanceof Date);
  assert.equal(audit.entity_type, null);
  assert.equal(audit.entity_id, null);

  await expectPgError(
    testSql`
      insert into audit_events (event_type, retention_until)
      values ('AUTH_LOGIN_FAILED', now() - interval '1 day')`,
    "23514",
    "audit_events_retention_after_created",
  );

  const [minimal] = await testSql`
    insert into audit_events (event_type, retention_until)
    values ('PASSWORD_CHANGED', now() + interval '180 days')
    returning actor_user_id, device_id`;
  assert.equal(minimal.actor_user_id, null);
  assert.equal(minimal.device_id, null);

  const indexes = await testSql`
    select indexname from pg_indexes
    where schemaname = 'public'
      and indexname = 'audit_events_retention_until_idx'`;
  assert.equal(indexes.length, 1);
});

// PG18 reports ON DELETE RESTRICT violations as 23001 (restrict_violation);
// insert-side foreign key violations still use 23503.
test("phase2 foreign keys restrict deletes of referenced rows", async () => {
  const userId = await createUser();
  const device = await createDevice(userId);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await testSql`
    insert into sessions (user_id, token_hash, csrf_token_hash, expires_at)
    values (${userId}, ${`sess-${randomSuffix()}`}, 'csrf', ${expiresAt})`;
  await expectPgError(
    testSql`delete from users where id = ${userId}`,
    "23001",
    "sessions_user_id_users_id_fk",
  );

  await createDeviceKey(device.id);
  await expectPgError(
    testSql`delete from devices where id = ${device.id}`,
    "23001",
    "device_keys_device_id_devices_id_fk",
  );

  const shiftId = await createOfflineShift(userId, device.id);
  await createSale(shiftId, userId, offlineSaleOptions(device.id));
  await expectPgError(
    testSql`delete from devices where id = ${device.id}`,
    "23001",
    "device_keys_device_id_devices_id_fk",
  );

  const saleDevice = await createDevice(userId);
  const saleUserId = await createUser();
  const [onlineShift] = await testSql`
    insert into cashier_shifts (user_id)
    values (${saleUserId})
    returning id`;
  await createSale(
    onlineShift.id,
    saleUserId,
    offlineSaleOptions(saleDevice.id),
  );
  await expectPgError(
    testSql`delete from devices where id = ${saleDevice.id}`,
    "23001",
    "sales_device_id_devices_id_fk",
  );

  const tokenUserId = await createUser();
  const tokenDevice = await createDevice(userId);
  await testSql`
    insert into offline_tokens (
      jti, device_id, issued_to_user_id, scope, expires_at, grace_until
    )
    values (
      ${crypto.randomUUID()}, ${tokenDevice.id}, ${tokenUserId},
      ${["sales:create"]}, ${expiresAt},
      ${new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000)}
    )`;
  await expectPgError(
    testSql`delete from users where id = ${tokenUserId}`,
    "23001",
    "offline_tokens_issued_to_user_id_users_id_fk",
  );
});

test("stock_opnames.submitted_at is nullable and keeps PENDING on submission", async () => {
  const userId = await createUser();
  const [opname] = await testSql`
    insert into stock_opnames (opname_no, location, created_by)
    values (${`OP-${randomSuffix()}`}, 'STORE', ${userId})
    returning id, status, submitted_at`;
  assert.equal(opname.status, "PENDING");
  assert.equal(opname.submitted_at, null);

  const [submitted] = await testSql`
    update stock_opnames
    set submitted_at = now()
    where id = ${opname.id}
    returning status, submitted_at`;
  assert.equal(submitted.status, "PENDING");
  assert.ok(submitted.submitted_at instanceof Date);
});

import type postgres from "postgres";

import type { Role } from "./permissions.ts";

export type DbClient = postgres.Sql | postgres.TransactionSql;

export interface UserRow {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  passwordPepperVersion: number;
  passwordChangedAt: Date;
  credentialVersion: number;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionUserRow extends UserRow {
  sessionId: string;
  sessionUserId: string;
  csrfTokenHash: string;
  sessionExpiresAt: Date;
  sessionCreatedAt: Date;
  sessionRevokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
  lastLoginAt: Date | null;
}

export interface InsertedSessionRow {
  id: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface AuditEventInput {
  eventType: string;
  actorUserId?: string | null;
  deviceId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function getSqlClient(): Promise<postgres.Sql> {
  const { sql } = await import("../db/client.ts");
  return sql;
}

export async function findUserByUsername(
  username: string,
): Promise<UserRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      id, name, username, password_hash, password_pepper_version,
      password_changed_at, credential_version, role, is_active,
      created_at, updated_at
    from users
    where username = ${username}
    limit 1`;

  return row ? mapUserRow(row) : null;
}

export async function findSessionByTokenHash(
  tokenHash: string,
): Promise<SessionUserRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      s.id as session_id,
      s.user_id as session_user_id,
      s.csrf_token_hash,
      s.expires_at as session_expires_at,
      s.created_at as session_created_at,
      s.revoked_at as session_revoked_at,
      s.user_agent,
      s.ip,
      u.id,
      u.name,
      u.username,
      u.password_hash,
      u.password_pepper_version,
      u.password_changed_at,
      u.credential_version,
      u.role,
      u.is_active,
      u.created_at,
      u.updated_at,
      (
        select max(login.created_at)
        from sessions login
        where login.user_id = u.id
      ) as last_login_at
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
    limit 1`;

  if (!row) return null;

  return {
    ...mapUserRow(row),
    sessionId: row.session_id,
    sessionUserId: row.session_user_id,
    csrfTokenHash: row.csrf_token_hash,
    sessionExpiresAt: row.session_expires_at,
    sessionCreatedAt: row.session_created_at,
    sessionRevokedAt: row.session_revoked_at,
    userAgent: row.user_agent,
    ip: row.ip,
    lastLoginAt: row.last_login_at,
  };
}

export async function insertSession(
  client: DbClient,
  input: {
    userId: string;
    tokenHash: string;
    csrfTokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
    ip: string | null;
  },
): Promise<InsertedSessionRow> {
  const [row] = await client`
    insert into sessions (
      user_id, token_hash, csrf_token_hash, expires_at, user_agent, ip
    )
    values (
      ${input.userId}, ${input.tokenHash}, ${input.csrfTokenHash},
      ${input.expiresAt.toISOString()}::timestamptz,
      ${input.userAgent}, ${input.ip}
    )
    returning id, created_at, expires_at`;

  return {
    id: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function revokeSessionById(
  client: DbClient,
  sessionId: string,
): Promise<{ id: string; userId: string } | null> {
  const [row] = await client`
    update sessions
    set revoked_at = coalesce(revoked_at, now())
    where id = ${sessionId}
    returning id, user_id`;

  return row ? { id: row.id, userId: row.user_id } : null;
}

export async function revokeActiveSessionsForUser(
  client: DbClient,
  userId: string,
): Promise<Array<{ id: string; userId: string }>> {
  const rows = await client`
    update sessions
    set revoked_at = now()
    where user_id = ${userId} and revoked_at is null
    returning id, user_id`;

  return rows.map((row: postgres.Row) => ({
    id: row.id,
    userId: row.user_id,
  }));
}

export async function updateUserPasswordHash(
  client: DbClient,
  input: {
    userId: string;
    passwordHash: string;
    pepperVersion: number;
  },
): Promise<void> {
  await client`
    update users
    set
      password_hash = ${input.passwordHash},
      password_pepper_version = ${input.pepperVersion},
      updated_at = now()
    where id = ${input.userId}`;
}

export async function insertAuditEvent(
  client: DbClient,
  input: AuditEventInput,
): Promise<void> {
  const now = new Date();
  const retentionUntil = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  await client`
    insert into audit_events (
      event_type, actor_user_id, device_id, entity_type, entity_id,
      metadata, retention_until
    )
    values (
      ${input.eventType},
      ${input.actorUserId ?? null},
      ${input.deviceId ?? null},
      ${input.entityType ?? null},
      ${input.entityId ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb,
      ${retentionUntil.toISOString()}::timestamptz
    )`;
}

function mapUserRow(row: postgres.Row): UserRow {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    passwordHash: row.password_hash,
    passwordPepperVersion: Number(row.password_pepper_version),
    passwordChangedAt: row.password_changed_at,
    credentialVersion: Number(row.credential_version),
    role: row.role as Role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface DeviceRow {
  id: string;
  name: string;
  platform: "ANDROID" | "TAURI";
  status: "PENDING" | "ACTIVE" | "REVOKED";
  enrolledByUserId: string;
  enrolledAt: Date | null;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceKeyRow {
  id: string;
  deviceId: string;
  keyId: string;
  publicKey: string;
  keyAlg: string;
  status: "ACTIVE" | "RETIRED" | "REVOKED";
  createdAt: Date;
  activatedAt: Date | null;
  retiredAt: Date | null;
  acceptedUntil: Date | null;
  revokedAt: Date | null;
}

export interface DeviceWithKeyRow {
  device: DeviceRow;
  key: DeviceKeyRow;
}

export interface RefreshTokenRow {
  id: string;
  deviceId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface SessionWithUserRow {
  id: string;
  csrfTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
  user: UserRow;
}

export interface DevicePageRow {
  items: DeviceRow[];
  total: number;
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      id, name, username, password_hash, password_pepper_version,
      password_changed_at, credential_version, role, is_active,
      created_at, updated_at
    from users
    where id = ${userId}
    limit 1`;
  return row ? mapUserRow(row) : null;
}

export interface UserWithLastLoginRow extends UserRow {
  lastLoginAt: Date | null;
}

const USER_COLUMNS = (client: DbClient) => client`
  id, name, username, password_hash, password_pepper_version,
  password_changed_at, credential_version, role, is_active,
  created_at, updated_at`;

export async function insertUser(
  client: DbClient,
  input: {
    name: string;
    username: string;
    passwordHash: string;
    pepperVersion: number;
    role: Role;
  },
): Promise<UserRow> {
  const [row] = await client`
    insert into users (
      name, username, password_hash, password_pepper_version, role
    )
    values (
      ${input.name}, ${input.username}, ${input.passwordHash},
      ${input.pepperVersion}, ${input.role}
    )
    returning ${USER_COLUMNS(client)}`;
  return mapUserRow(row);
}

export async function updateUserRecord(
  client: DbClient,
  input: {
    userId: string;
    name?: string;
    role?: Role;
  },
): Promise<UserRow | null> {
  const current = await client`
    select
      id, name, username, password_hash, password_pepper_version,
      password_changed_at, credential_version, role, is_active,
      created_at, updated_at
    from users where id = ${input.userId} limit 1`;
  if (!current[0]) return null;

  const [row] = await client`
    update users
    set
      name = ${input.name ?? current[0].name},
      role = ${input.role ?? current[0].role},
      updated_at = now()
    where id = ${input.userId}
    returning ${USER_COLUMNS(client)}`;
  return row ? mapUserRow(row) : null;
}

export async function setUserActiveById(
  client: DbClient,
  input: { userId: string; isActive: boolean },
): Promise<UserRow | null> {
  const [row] = await client`
    update users
    set is_active = ${input.isActive}, updated_at = now()
    where id = ${input.userId}
    returning ${USER_COLUMNS(client)}`;
  return row ? mapUserRow(row) : null;
}

export async function resetUserPasswordById(
  client: DbClient,
  input: {
    userId: string;
    passwordHash: string;
    pepperVersion: number;
  },
): Promise<UserRow | null> {
  const [row] = await client`
    update users
    set
      password_hash = ${input.passwordHash},
      password_pepper_version = ${input.pepperVersion},
      password_changed_at = now(),
      credential_version = credential_version + 1,
      updated_at = now()
    where id = ${input.userId}
    returning ${USER_COLUMNS(client)}`;
  return row ? mapUserRow(row) : null;
}

export async function listUsersWithLastLogin(input: {
  search?: string | null;
  role?: Role | null;
  isActive?: boolean | null;
  orderBy: string;
  direction: "ASC" | "DESC";
  limit: number;
  offset: number;
}): Promise<{ rows: UserWithLastLoginRow[]; total: number }> {
  const sql = await getSqlClient();
  const search = input.search ? `%${input.search}%` : null;
  const role = input.role ?? null;
  const isActive = input.isActive ?? null;
  const direction = input.direction === "ASC" ? sql`asc` : sql`desc`;

  const [countRow] = await sql`
    select count(*)::int as total
    from users u
    where (${search}::text is null
        or u.name ilike ${search} or u.username ilike ${search})
      and (${role}::text is null or u.role::text = ${role})
      and (${isActive}::boolean is null or u.is_active = ${isActive})`;

  const rows = await sql`
    select
      u.id, u.name, u.username, u.password_hash, u.password_pepper_version,
      u.password_changed_at, u.credential_version, u.role, u.is_active,
      u.created_at, u.updated_at,
      (
        select max(s.created_at)
        from sessions s
        where s.user_id = u.id
      ) as last_login_at
    from users u
    where (${search}::text is null
        or u.name ilike ${search} or u.username ilike ${search})
      and (${role}::text is null or u.role::text = ${role})
      and (${isActive}::boolean is null or u.is_active = ${isActive})
    order by ${sql(input.orderBy)} ${direction}
    limit ${input.limit} offset ${input.offset}`;

  return {
    rows: rows.map((row: postgres.Row) => ({
      ...mapUserRow(row),
      lastLoginAt: row.last_login_at,
    })),
    total: Number(countRow.total),
  };
}

export async function findUserWithLastLogin(
  userId: string,
): Promise<UserWithLastLoginRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      u.id, u.name, u.username, u.password_hash, u.password_pepper_version,
      u.password_changed_at, u.credential_version, u.role, u.is_active,
      u.created_at, u.updated_at,
      (
        select max(s.created_at)
        from sessions s
        where s.user_id = u.id
      ) as last_login_at
    from users u
    where u.id = ${userId}
    limit 1`;
  return row ? { ...mapUserRow(row), lastLoginAt: row.last_login_at } : null;
}

export async function findDeviceById(
  deviceId: string,
): Promise<DeviceRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      id, name, platform, status, enrolled_by_user_id, enrolled_at,
      last_seen_at, revoked_at, created_at, updated_at
    from devices
    where id = ${deviceId}
    limit 1`;
  return row ? mapDeviceRow(row) : null;
}

export async function findDeviceWithKey(
  deviceId: string,
  keyId: string,
): Promise<DeviceWithKeyRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      d.id as device_id,
      d.name as device_name,
      d.platform as device_platform,
      d.status as device_status,
      d.enrolled_by_user_id,
      d.enrolled_at as device_enrolled_at,
      d.last_seen_at as device_last_seen_at,
      d.revoked_at as device_revoked_at,
      d.created_at as device_created_at,
      d.updated_at as device_updated_at,
      k.id as key_record_id,
      k.key_id,
      k.public_key,
      k.key_alg,
      k.status as key_status,
      k.created_at as key_created_at,
      k.activated_at,
      k.retired_at,
      k.accepted_until,
      k.revoked_at as key_revoked_at
    from devices d
    join device_keys k on k.device_id = d.id
    where d.id = ${deviceId} and k.key_id = ${keyId}
    limit 1`;

  if (!row) return null;

  return {
    device: mapDeviceRow({
      id: row.device_id,
      name: row.device_name,
      platform: row.device_platform,
      status: row.device_status,
      enrolled_by_user_id: row.enrolled_by_user_id,
      enrolled_at: row.device_enrolled_at,
      last_seen_at: row.device_last_seen_at,
      revoked_at: row.device_revoked_at,
      created_at: row.device_created_at,
      updated_at: row.device_updated_at,
    }),
    key: mapDeviceKeyRow({
      id: row.key_record_id,
      device_id: row.device_id,
      key_id: row.key_id,
      public_key: row.public_key,
      key_alg: row.key_alg,
      status: row.key_status,
      created_at: row.key_created_at,
      activated_at: row.activated_at,
      retired_at: row.retired_at,
      accepted_until: row.accepted_until,
      revoked_at: row.key_revoked_at,
    }),
  };
}

export async function listDeviceKeys(
  deviceId: string,
): Promise<DeviceKeyRow[]> {
  const sql = await getSqlClient();
  const rows = await sql`
    select
      id, device_id, key_id, public_key, key_alg, status, created_at,
      activated_at, retired_at, accepted_until, revoked_at
    from device_keys
    where device_id = ${deviceId}
    order by created_at, id`;
  return rows.map(mapDeviceKeyRow);
}

export async function listDevices(input: {
  search?: string | null;
  platform?: string | null;
  status?: string | null;
  page: number;
  pageSize: number;
}): Promise<DevicePageRow> {
  const sql = await getSqlClient();
  const search = input.search ? `%${input.search}%` : null;
  const platform = input.platform ?? null;
  const status = input.status ?? null;
  const offset = (input.page - 1) * input.pageSize;

  const [countRow] = await sql`
    select count(*)::int as total
    from devices
    where (${search}::text is null or name ilike ${search})
      and (${platform}::text is null or platform::text = ${platform})
      and (${status}::text is null or status::text = ${status})`;

  const rows = await sql`
    select
      id, name, platform, status, enrolled_by_user_id, enrolled_at,
      last_seen_at, revoked_at, created_at, updated_at
    from devices
    where (${search}::text is null or name ilike ${search})
      and (${platform}::text is null or platform::text = ${platform})
      and (${status}::text is null or status::text = ${status})
    order by created_at desc, id
    limit ${input.pageSize} offset ${offset}`;

  return {
    items: rows.map(mapDeviceRow),
    total: Number(countRow.total),
  };
}

export async function createDeviceWithKey(
  client: DbClient,
  input: {
    name: string;
    platform: "ANDROID" | "TAURI";
    enrolledByUserId: string;
    keyId: string;
    publicKey: string;
  },
): Promise<{ device: DeviceRow; key: DeviceKeyRow }> {
  const [deviceRow] = await client`
    insert into devices (
      name, platform, enrolled_by_user_id, status
    )
    values (${input.name}, ${input.platform}, ${input.enrolledByUserId}, 'PENDING')
    returning
      id, name, platform, status, enrolled_by_user_id, enrolled_at,
      last_seen_at, revoked_at, created_at, updated_at`;

  const [keyRow] = await client`
    insert into device_keys (
      device_id, key_id, public_key, key_alg, status, activated_at
    )
    values (
      ${deviceRow.id}, ${input.keyId}, ${input.publicKey}, 'Ed25519',
      'ACTIVE', now()
    )
    returning
      id, device_id, key_id, public_key, key_alg, status, created_at,
      activated_at, retired_at, accepted_until, revoked_at`;

  return {
    device: mapDeviceRow(deviceRow),
    key: mapDeviceKeyRow(keyRow),
  };
}

export async function approveDeviceById(
  client: DbClient,
  deviceId: string,
): Promise<DeviceRow | null> {
  const [row] = await client`
    update devices
    set
      status = 'ACTIVE',
      enrolled_at = coalesce(enrolled_at, now()),
      updated_at = now()
    where id = ${deviceId} and status = 'PENDING'
    returning
      id, name, platform, status, enrolled_by_user_id, enrolled_at,
      last_seen_at, revoked_at, created_at, updated_at`;
  return row ? mapDeviceRow(row) : null;
}

export async function revokeDeviceById(
  client: DbClient,
  deviceId: string,
): Promise<DeviceRow | null> {
  const [row] = await client`
    update devices
    set
      status = 'REVOKED',
      revoked_at = coalesce(revoked_at, now()),
      updated_at = now()
    where id = ${deviceId} and status <> 'REVOKED'
    returning
      id, name, platform, status, enrolled_by_user_id, enrolled_at,
      last_seen_at, revoked_at, created_at, updated_at`;

  if (!row) return null;

  await client`
    update device_keys
    set status = 'REVOKED', revoked_at = coalesce(revoked_at, now())
    where device_id = ${deviceId} and status <> 'REVOKED'`;

  await client`
    update refresh_tokens
    set revoked_at = coalesce(revoked_at, now())
    where device_id = ${deviceId} and revoked_at is null`;

  await client`
    update offline_tokens
    set revoked_at = coalesce(revoked_at, now())
    where device_id = ${deviceId} and revoked_at is null`;

  return mapDeviceRow(row);
}

export async function retireDeviceKey(
  client: DbClient,
  input: {
    deviceId: string;
    retiredAt: Date;
    acceptedUntil: Date;
  },
): Promise<void> {
  await client`
    update device_keys
    set
      status = 'RETIRED',
      retired_at = ${input.retiredAt.toISOString()}::timestamptz,
      accepted_until = ${input.acceptedUntil.toISOString()}::timestamptz
    where device_id = ${input.deviceId} and status = 'ACTIVE'`;
}

export async function insertDeviceKey(
  client: DbClient,
  input: {
    deviceId: string;
    keyId: string;
    publicKey: string;
    activatedAt: Date;
  },
): Promise<DeviceKeyRow> {
  const [row] = await client`
    insert into device_keys (
      device_id, key_id, public_key, key_alg, status, activated_at
    )
    values (
      ${input.deviceId}, ${input.keyId}, ${input.publicKey}, 'Ed25519',
      'ACTIVE', ${input.activatedAt.toISOString()}::timestamptz
    )
    returning
      id, device_id, key_id, public_key, key_alg, status, created_at,
      activated_at, retired_at, accepted_until, revoked_at`;
  return mapDeviceKeyRow(row);
}

export async function updateDeviceLastSeen(
  deviceId: string,
  at: Date,
): Promise<void> {
  const sql = await getSqlClient();
  await sql`
    update devices
    set last_seen_at = ${at.toISOString()}::timestamptz, updated_at = now()
    where id = ${deviceId}`;
}

export async function insertAuthNonce(
  client: DbClient,
  input: { nonceHash: string; deviceId: string; expiresAt: Date },
): Promise<void> {
  await client`
    insert into auth_nonces (nonce_hash, device_id, expires_at)
    values (
      ${input.nonceHash}, ${input.deviceId},
      ${input.expiresAt.toISOString()}::timestamptz
    )`;
}

export async function consumeAuthNonce(
  client: DbClient,
  input: { nonceHash: string; deviceId: string; now: Date },
): Promise<boolean> {
  const rows = await client`
    update auth_nonces
    set used_at = now()
    where nonce_hash = ${input.nonceHash}
      and device_id = ${input.deviceId}
      and used_at is null
      and expires_at > ${input.now.toISOString()}::timestamptz
    returning id`;
  return rows.length > 0;
}

export async function insertRefreshToken(
  client: DbClient,
  input: {
    deviceId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  },
): Promise<RefreshTokenRow> {
  const [row] = await client`
    insert into refresh_tokens (device_id, token_hash, family_id, expires_at)
    values (
      ${input.deviceId}, ${input.tokenHash}, ${input.familyId},
      ${input.expiresAt.toISOString()}::timestamptz
    )
    returning
      id, device_id, token_hash, family_id, expires_at, rotated_at,
      revoked_at, created_at`;
  return mapRefreshTokenRow(row);
}

export async function findRefreshTokenByHash(
  tokenHash: string,
): Promise<RefreshTokenRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      id, device_id, token_hash, family_id, expires_at, rotated_at,
      revoked_at, created_at
    from refresh_tokens
    where token_hash = ${tokenHash}
    limit 1`;
  return row ? mapRefreshTokenRow(row) : null;
}

export async function rotateRefreshToken(
  client: DbClient,
  tokenId: string,
): Promise<boolean> {
  const rows = await client`
    update refresh_tokens
    set rotated_at = now()
    where id = ${tokenId} and rotated_at is null and revoked_at is null
    returning id`;
  return rows.length > 0;
}

export async function revokeRefreshTokenFamily(
  client: DbClient,
  familyId: string,
): Promise<void> {
  await client`
    update refresh_tokens
    set revoked_at = coalesce(revoked_at, now())
    where family_id = ${familyId} and revoked_at is null`;
}

export async function revokeDeviceRefreshTokens(
  client: DbClient,
  deviceId: string,
): Promise<void> {
  await client`
    update refresh_tokens
    set revoked_at = coalesce(revoked_at, now())
    where device_id = ${deviceId} and revoked_at is null`;
}

export async function listSessionsWithUsers(): Promise<SessionWithUserRow[]> {
  const sql = await getSqlClient();
  const rows = await sql`
    select
      s.id as session_id,
      s.csrf_token_hash,
      s.expires_at as session_expires_at,
      s.created_at as session_created_at,
      s.last_seen_at as session_last_seen_at,
      s.revoked_at as session_revoked_at,
      s.user_agent,
      s.ip,
      u.id,
      u.name,
      u.username,
      u.password_hash,
      u.password_pepper_version,
      u.password_changed_at,
      u.credential_version,
      u.role,
      u.is_active,
      u.created_at,
      u.updated_at
    from sessions s
    join users u on u.id = s.user_id
    order by s.created_at desc, s.id`;

  return rows.map((row: postgres.Row) => ({
    id: row.session_id,
    csrfTokenHash: row.csrf_token_hash,
    expiresAt: row.session_expires_at,
    createdAt: row.session_created_at,
    lastSeenAt: row.session_last_seen_at,
    revokedAt: row.session_revoked_at,
    userAgent: row.user_agent,
    ip: row.ip,
    user: mapUserRow(row),
  }));
}

function mapDeviceRow(row: postgres.Row): DeviceRow {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    status: row.status,
    enrolledByUserId: row.enrolled_by_user_id,
    enrolledAt: row.enrolled_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDeviceKeyRow(row: postgres.Row): DeviceKeyRow {
  return {
    id: row.id,
    deviceId: row.device_id,
    keyId: row.key_id,
    publicKey: row.public_key,
    keyAlg: row.key_alg,
    status: row.status,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    retiredAt: row.retired_at,
    acceptedUntil: row.accepted_until,
    revokedAt: row.revoked_at,
  };
}

function mapRefreshTokenRow(row: postgres.Row): RefreshTokenRow {
  return {
    id: row.id,
    deviceId: row.device_id,
    tokenHash: row.token_hash,
    familyId: row.family_id,
    expiresAt: row.expires_at,
    rotatedAt: row.rotated_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export async function touchDevice(
  client: DbClient,
  deviceId: string,
  at: Date,
): Promise<void> {
  await client`
    update devices
    set last_seen_at = ${at.toISOString()}::timestamptz, updated_at = now()
    where id = ${deviceId}`;
}

export interface OfflineTokenRow {
  jti: string;
  deviceId: string;
  issuedToUserId: string;
  scope: string[];
  issuedAt: Date;
  expiresAt: Date;
  graceUntil: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  lastSeenAt: Date | null;
}

export async function insertOfflineToken(
  client: DbClient,
  input: {
    jti: string;
    deviceId: string;
    issuedToUserId: string;
    scope: string[];
    issuedAt: Date;
    expiresAt: Date;
    graceUntil: Date;
  },
): Promise<OfflineTokenRow> {
  const [row] = await client`
    insert into offline_tokens (
      jti, device_id, issued_to_user_id, scope, issued_at, expires_at,
      grace_until
    )
    values (
      ${input.jti}, ${input.deviceId}, ${input.issuedToUserId},
      ${input.scope}::text[], ${input.issuedAt.toISOString()}::timestamptz,
      ${input.expiresAt.toISOString()}::timestamptz,
      ${input.graceUntil.toISOString()}::timestamptz
    )
    returning
      jti, device_id, issued_to_user_id, scope, issued_at, expires_at,
      grace_until, rotated_at, revoked_at, last_seen_at`;
  return mapOfflineTokenRow(row);
}

export async function findOfflineTokenByJti(
  jti: string,
): Promise<OfflineTokenRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      jti, device_id, issued_to_user_id, scope, issued_at, expires_at,
      grace_until, rotated_at, revoked_at, last_seen_at
    from offline_tokens where jti = ${jti} limit 1`;
  return row ? mapOfflineTokenRow(row) : null;
}

export async function latestOfflineTokenForDevice(
  deviceId: string,
): Promise<OfflineTokenRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      jti, device_id, issued_to_user_id, scope, issued_at, expires_at,
      grace_until, rotated_at, revoked_at, last_seen_at
    from offline_tokens
    where device_id = ${deviceId}
    order by issued_at desc, jti desc
    limit 1`;
  return row ? mapOfflineTokenRow(row) : null;
}

export async function offlineTokenForDeviceAt(
  deviceId: string,
  at: Date,
): Promise<OfflineTokenRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      jti, device_id, issued_to_user_id, scope, issued_at, expires_at,
      grace_until, rotated_at, revoked_at, last_seen_at
    from offline_tokens
    where device_id = ${deviceId}
    order by
      (issued_at <= ${at.toISOString()}::timestamptz) desc,
      (case
        when issued_at <= ${at.toISOString()}::timestamptz then issued_at
      end) desc,
      issued_at asc, jti asc
    limit 1`;
  return row ? mapOfflineTokenRow(row) : null;
}

export async function rotateOfflineToken(
  client: DbClient,
  jti: string,
): Promise<boolean> {
  const rows = await client`
    update offline_tokens
    set rotated_at = now()
    where jti = ${jti} and rotated_at is null and revoked_at is null
    returning jti`;
  return rows.length > 0;
}

export interface SyncBatchRow {
  id: string;
  deviceId: string;
  clientBatchId: string;
  batchHash: string;
  receivedAt: Date;
  acceptedCount: number;
  flaggedCount: number;
  rejectedCount: number;
}

export async function insertSyncBatch(
  client: DbClient,
  input: {
    deviceId: string;
    clientBatchId: string;
    batchHash: string;
  },
): Promise<SyncBatchRow> {
  const [row] = await client`
    insert into sync_batches (device_id, client_batch_id, batch_hash)
    values (${input.deviceId}, ${input.clientBatchId}, ${input.batchHash})
    returning
      id, device_id, client_batch_id, batch_hash, received_at,
      accepted_count, flagged_count, rejected_count`;
  return mapSyncBatchRow(row);
}

export async function findSyncBatch(
  deviceId: string,
  clientBatchId: string,
): Promise<SyncBatchRow | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select
      id, device_id, client_batch_id, batch_hash, received_at,
      accepted_count, flagged_count, rejected_count
    from sync_batches
    where device_id = ${deviceId} and client_batch_id = ${clientBatchId}
    limit 1`;
  return row ? mapSyncBatchRow(row) : null;
}

export async function updateSyncBatchCounts(
  client: DbClient,
  id: string,
  counts: { accepted: number; flagged: number; rejected: number },
): Promise<void> {
  await client`
    update sync_batches
    set
      accepted_count = ${counts.accepted},
      flagged_count = ${counts.flagged},
      rejected_count = ${counts.rejected}
    where id = ${id}`;
}

export async function findSaleIdByDeviceClientOrder(
  deviceId: string,
  clientOrderId: string,
): Promise<string | null> {
  const sql = await getSqlClient();
  const [row] = await sql`
    select id from sales
    where device_id = ${deviceId} and client_order_id = ${clientOrderId}
    limit 1`;
  return row?.id ?? null;
}

export async function insertDeviceEvent(
  client: DbClient,
  input: {
    deviceId: string;
    type: string;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await client`
    insert into device_events (device_id, type, actor_user_id, metadata)
    values (
      ${input.deviceId}, ${input.type}, ${input.actorUserId ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )`;
}

function mapOfflineTokenRow(row: postgres.Row): OfflineTokenRow {
  return {
    jti: row.jti,
    deviceId: row.device_id,
    issuedToUserId: row.issued_to_user_id,
    scope: row.scope as string[],
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    graceUntil: row.grace_until,
    rotatedAt: row.rotated_at,
    revokedAt: row.revoked_at,
    lastSeenAt: row.last_seen_at,
  };
}

function mapSyncBatchRow(row: postgres.Row): SyncBatchRow {
  return {
    id: row.id,
    deviceId: row.device_id,
    clientBatchId: row.client_batch_id,
    batchHash: row.batch_hash,
    receivedAt: row.received_at,
    acceptedCount: Number(row.accepted_count),
    flaggedCount: Number(row.flagged_count),
    rejectedCount: Number(row.rejected_count),
  };
}

import { randomBytes } from "node:crypto";

import { getPepper, hashPassword } from "../auth/passwords.ts";
import {
  canManageUser,
  type Role,
  type UserManagementAction,
} from "../auth/permissions.ts";
import {
  findUserById,
  findUserWithLastLogin,
  getSqlClient,
  insertAuditEvent,
  insertUser,
  listUsersWithLastLogin,
  resetUserPasswordById,
  revokeActiveSessionsForUser,
  setUserActiveById,
  updateUserRecord,
  type UserRow,
  type UserWithLastLoginRow,
} from "../auth/repository.ts";
import { userRowToContextUser } from "../auth/user-mapper.ts";
import {
  normalizePage,
  type PageInfo,
  pageInfo,
  resolveSort,
} from "../db/query.ts";
import type { RequestContext } from "../graphql/context.ts";
import type { ContextUser } from "../graphql/context.ts";
import {
  conflict,
  forbidden,
  notFound,
  validationFailed,
} from "../graphql/errors.ts";

export interface UserPageView {
  items: ContextUser[];
  pageInfo: PageInfo;
}

export interface ResetUserPasswordView {
  user: ContextUser;
  temporaryPassword: string;
}

const TEMP_PASSWORD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const TEMP_PASSWORD_LOWER = "abcdefghijkmnopqrstuvwxyz";
const TEMP_PASSWORD_DIGITS = "23456789";
const TEMP_PASSWORD_ALPHABET = [
  ...TEMP_PASSWORD_UPPER,
  ...TEMP_PASSWORD_LOWER,
  ...TEMP_PASSWORD_DIGITS,
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function assertActor(context: RequestContext): {
  id: string;
  role: Role;
} {
  if (!context.user || !context.role) {
    throw forbidden("Operasi ini memerlukan sesi web.");
  }
  return { id: context.user.id, role: context.role };
}

function assertCanManage(
  actorRole: Role,
  targetRole: Role,
  action: UserManagementAction,
): void {
  if (!canManageUser(actorRole, targetRole, action)) {
    throw forbidden("ADMIN tidak dapat mengelola akun OWNER.");
  }
}

function assertAssignableRole(actorRole: Role, role: Role): void {
  if (actorRole === "ADMIN" && role === "OWNER") {
    throw forbidden("Hanya OWNER yang dapat memberikan role OWNER.");
  }
}

function toContext(
  row: UserWithLastLoginRow | UserRow,
  lastLoginAt: Date | null = null,
): ContextUser {
  return userRowToContextUser(row, lastLoginAt);
}

function generateTemporaryPassword(): string {
  const bytes = randomBytes(16);
  let value = "";
  for (const byte of bytes) {
    value += TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length];
  }
  return value;
}

function normalizeName(value: string): string {
  const name = value.trim();
  if (!name) throw validationFailed("Nama pengguna wajib diisi.");
  return name;
}

function normalizeUsername(value: string): string {
  const username = value.trim();
  if (!username) throw validationFailed("Username wajib diisi.");
  return username;
}

export async function listUsers(input: {
  filter?: {
    search?: string | null;
    role?: Role | null;
    isActive?: boolean | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<UserPageView> {
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      name: "u.name",
      username: "u.username",
      role: "u.role",
      isActive: "u.is_active",
      createdAt: "u.created_at",
      lastLoginAt: "last_login_at",
    },
    "u.created_at",
  );
  const { rows, total } = await listUsersWithLastLogin({
    search: input.filter?.search ?? null,
    role: input.filter?.role ?? null,
    isActive: input.filter?.isActive ?? null,
    orderBy: order.expression,
    direction: order.direction,
    limit: page.pageSize,
    offset: (page.page - 1) * page.pageSize,
  });

  return {
    items: rows.map((row) => toContext(row, row.lastLoginAt)),
    pageInfo: pageInfo(page, total),
  };
}

export async function getUser(id: string): Promise<ContextUser | null> {
  if (!isUuid(id)) return null;
  const row = await findUserWithLastLogin(id);
  return row ? toContext(row, row.lastLoginAt) : null;
}

export async function createUser(
  context: RequestContext,
  input: {
    name: string;
    username: string;
    password: string;
    role: Role;
  },
): Promise<ContextUser> {
  const actor = assertActor(context);
  assertCanManage(actor.role, input.role, "create");
  assertAssignableRole(actor.role, input.role);

  const name = normalizeName(input.name);
  const username = normalizeUsername(input.username);
  if (!input.password) {
    throw validationFailed("Password wajib diisi.");
  }

  const pepper = getPepper(
    context.auth.peppers,
    context.auth.peppers.currentVersion,
  );
  const passwordHash = await context.auth.argon2.run(() =>
    hashPassword(input.password, pepper),
  );

  const client = await getSqlClient();
  try {
    return await client.begin(async (transaction) => {
      const user = await insertUser(transaction, {
        name,
        username,
        passwordHash,
        pepperVersion: context.auth.peppers.currentVersion,
        role: input.role,
      });
      await insertAuditEvent(transaction, {
        eventType: "USER_CREATED",
        actorUserId: actor.id,
        entityType: "user",
        entityId: user.id,
        metadata: { username: user.username, role: user.role },
      });
      return toContext(user);
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw conflict("Username sudah dipakai.");
    }
    throw error;
  }
}

export async function updateUser(
  context: RequestContext,
  id: string,
  input: { name?: string | null; role?: Role | null },
): Promise<ContextUser> {
  const actor = assertActor(context);
  if (!isUuid(id)) throw notFound("Pengguna tidak ditemukan.");
  const target = await findUserById(id);
  if (!target) throw notFound("Pengguna tidak ditemukan.");
  assertCanManage(actor.role, target.role, "update");
  const nextRole = input.role ?? null;
  if (nextRole) assertAssignableRole(actor.role, nextRole);

  const name =
    input.name === undefined || input.name === null
      ? undefined
      : normalizeName(input.name);

  const client = await getSqlClient();
  return client.begin(async (transaction) => {
    const updated = await updateUserRecord(transaction, {
      userId: id,
      ...(name === undefined ? {} : { name }),
      ...(nextRole === null ? {} : { role: nextRole }),
    });
    if (!updated) throw notFound("Pengguna tidak ditemukan.");

    await insertAuditEvent(transaction, {
      eventType: "USER_UPDATED",
      actorUserId: actor.id,
      entityType: "user",
      entityId: updated.id,
      metadata: {
        username: updated.username,
        nameChanged: name !== undefined && name !== target.name,
        previousRole: target.role,
        role: updated.role,
      },
    });
    return toContext(updated);
  });
}

export async function setUserActive(
  context: RequestContext,
  id: string,
  isActive: boolean,
): Promise<ContextUser> {
  const actor = assertActor(context);
  if (!isUuid(id)) throw notFound("Pengguna tidak ditemukan.");
  const target = await findUserById(id);
  if (!target) throw notFound("Pengguna tidak ditemukan.");
  assertCanManage(actor.role, target.role, "deactivate");

  const client = await getSqlClient();
  return client.begin(async (transaction) => {
    const updated = await setUserActiveById(transaction, {
      userId: id,
      isActive,
    });
    if (!updated) throw notFound("Pengguna tidak ditemukan.");

    const sessions = isActive
      ? []
      : await revokeActiveSessionsForUser(transaction, id);

    await insertAuditEvent(transaction, {
      eventType: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      actorUserId: actor.id,
      entityType: "user",
      entityId: updated.id,
      metadata: { username: updated.username },
    });
    for (const session of sessions) {
      await insertAuditEvent(transaction, {
        eventType: "SESSION_REVOKED",
        actorUserId: actor.id,
        entityType: "session",
        entityId: session.id,
        metadata: {
          sessionUserId: session.userId,
          reason: "USER_DEACTIVATED",
        },
      });
    }
    return toContext(updated);
  });
}

export async function resetUserPassword(
  context: RequestContext,
  id: string,
): Promise<ResetUserPasswordView> {
  const actor = assertActor(context);
  if (!isUuid(id)) throw notFound("Pengguna tidak ditemukan.");
  const target = await findUserById(id);
  if (!target) throw notFound("Pengguna tidak ditemukan.");
  assertCanManage(actor.role, target.role, "resetPassword");

  const temporaryPassword = generateTemporaryPassword();
  const pepper = getPepper(
    context.auth.peppers,
    context.auth.peppers.currentVersion,
  );
  const passwordHash = await context.auth.argon2.run(() =>
    hashPassword(temporaryPassword, pepper),
  );

  const client = await getSqlClient();
  const user = await client.begin(async (transaction) => {
    const updated = await resetUserPasswordById(transaction, {
      userId: id,
      passwordHash,
      pepperVersion: context.auth.peppers.currentVersion,
    });
    if (!updated) throw notFound("Pengguna tidak ditemukan.");

    const sessions = await revokeActiveSessionsForUser(transaction, id);
    await insertAuditEvent(transaction, {
      eventType: "USER_PASSWORD_RESET",
      actorUserId: actor.id,
      entityType: "user",
      entityId: updated.id,
      metadata: { username: updated.username },
    });
    for (const session of sessions) {
      await insertAuditEvent(transaction, {
        eventType: "SESSION_REVOKED",
        actorUserId: actor.id,
        entityType: "session",
        entityId: session.id,
        metadata: {
          sessionUserId: session.userId,
          reason: "PASSWORD_RESET",
        },
      });
    }
    return updated;
  });

  return { user: toContext(user), temporaryPassword };
}

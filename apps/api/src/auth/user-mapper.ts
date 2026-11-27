import type { ContextUser } from "../graphql/context.ts";
import type { UserRow } from "./repository.ts";

export function userRowToContextUser(
  row: UserRow,
  lastLoginAt: Date | null,
): ContextUser {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    isActive: row.isActive,
    lastLoginAt,
    passwordChangedAt: row.passwordChangedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

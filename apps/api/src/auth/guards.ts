import {
  canManageUser,
  hasPermission,
  type Permission,
  type Role,
  type UserManagementAction,
} from "./permissions.ts";

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";

  constructor(message = "Anda tidak punya akses.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError();
  }
}

export function requireRole(role: Role, allowed: readonly Role[]): void {
  if (!allowed.includes(role)) {
    throw new ForbiddenError();
  }
}

export function requireUserManagement(
  actorRole: Role,
  targetRole: Role,
  action: UserManagementAction,
): void {
  if (!canManageUser(actorRole, targetRole, action)) {
    throw new ForbiddenError();
  }
}

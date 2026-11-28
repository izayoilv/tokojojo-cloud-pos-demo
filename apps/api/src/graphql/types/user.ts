import type { Role } from "../../auth/permissions.ts";
import { builder } from "../builder.ts";
import type { ContextUser } from "../context.ts";
import { unauthenticated } from "../errors.ts";

export const UserRoleEnum = builder.enumType("UserRole", {
  values: ["OWNER", "ADMIN", "CASHIER", "WAREHOUSE"] as const,
});

export const UserRef = builder.objectRef<ContextUser>("User");

UserRef.implement({
  fields: (t) => ({
    id: t.id({ nullable: false, resolve: (user) => user.id }),
    name: t.string({ nullable: false, resolve: (user) => user.name }),
    username: t.string({ nullable: false, resolve: (user) => user.username }),
    role: t.field({
      type: UserRoleEnum,
      nullable: false,
      resolve: (user): Role => user.role,
    }),
    isActive: t.boolean({
      nullable: false,
      resolve: (user) => user.isActive,
    }),
    lastLoginAt: t.field({
      type: "DateTime",
      resolve: (user) => user.lastLoginAt,
    }),
    passwordChangedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (user) => user.passwordChangedAt,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (user) => user.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (user) => user.updatedAt,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    /**
     * Foundation context probe. Real session/token resolution lands in the auth
     * slice; until then every request is anonymous and this returns the coded
     * UNAUTHENTICATED error instead of leaking a placeholder user.
     */
    me: t.field({
      type: UserRef,
      nullable: false,
      resolve: (_parent, _args, context) => {
        if (!context.user) throw unauthenticated();
        return context.user;
      },
    }),
  }),
});

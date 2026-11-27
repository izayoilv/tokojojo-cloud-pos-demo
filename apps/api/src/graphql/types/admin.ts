import type {
  AuditEventPageView,
  AuditEventView,
} from "../../audit/service.ts";
import { listAuditEvents } from "../../audit/service.ts";
import type { Role } from "../../auth/permissions.ts";
import type {
  ResetUserPasswordView,
  UserPageView,
} from "../../users/service.ts";
import {
  createUser,
  getUser,
  listUsers,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "../../users/service.ts";
import { builder } from "../builder.ts";
import { DeviceRef } from "./auth.ts";
import {
  DateRangeInputRef,
  PageInfoRef,
  PageInputRef,
  SortInputRef,
} from "./common.ts";
import { UserRef, UserRoleEnum } from "./user.ts";

const UserPageRef = builder.objectRef<UserPageView>("UserPage");
const ResetUserPasswordPayloadRef = builder.objectRef<ResetUserPasswordView>(
  "ResetUserPasswordPayload",
);
const AuditEventRef = builder.objectRef<AuditEventView>("AuditEvent");
const AuditEventPageRef =
  builder.objectRef<AuditEventPageView>("AuditEventPage");

const UserFilterRef = builder.inputType("UserFilter", {
  fields: (t) => ({
    search: t.string(),
    role: t.field({ type: UserRoleEnum }),
    isActive: t.boolean(),
  }),
});

const CreateUserInputRef = builder.inputType("CreateUserInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    username: t.string({ required: true }),
    password: t.string({ required: true }),
    role: t.field({ type: UserRoleEnum, required: true }),
  }),
});

const UpdateUserInputRef = builder.inputType("UpdateUserInput", {
  fields: (t) => ({
    name: t.string(),
    role: t.field({ type: UserRoleEnum }),
  }),
});

const AuditEventFilterRef = builder.inputType("AuditEventFilter", {
  fields: (t) => ({
    eventType: t.string(),
    actorUserId: t.id(),
    deviceId: t.id(),
    entityType: t.string(),
    entityId: t.id(),
    range: t.field({ type: DateRangeInputRef }),
  }),
});

UserPageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [UserRef],
      nullable: false,
      resolve: (page) => page.items,
    }),
    pageInfo: t.field({
      type: PageInfoRef,
      nullable: false,
      resolve: (page) => page.pageInfo,
    }),
  }),
});

ResetUserPasswordPayloadRef.implement({
  fields: (t) => ({
    user: t.field({
      type: UserRef,
      nullable: false,
      resolve: (payload) => payload.user,
    }),
    temporaryPassword: t.exposeString("temporaryPassword", {
      nullable: false,
    }),
  }),
});

AuditEventRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    eventType: t.exposeString("eventType", { nullable: false }),
    actor: t.field({
      type: UserRef,
      resolve: (event) => event.actor,
    }),
    deviceId: t.exposeID("deviceId"),
    device: t.field({
      type: DeviceRef,
      resolve: (event) => event.device,
    }),
    entityType: t.exposeString("entityType"),
    entityId: t.exposeID("entityId"),
    metadata: t.exposeString("metadata", { nullable: false }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (event) => event.createdAt,
    }),
    retentionUntil: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (event) => event.retentionUntil,
    }),
  }),
});

AuditEventPageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [AuditEventRef],
      nullable: false,
      resolve: (page) => page.items,
    }),
    pageInfo: t.field({
      type: PageInfoRef,
      nullable: false,
      resolve: (page) => page.pageInfo,
    }),
  }),
});

builder.queryFields((t) => ({
  users: t.field({
    type: UserPageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: UserFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listUsers(args as never),
  }),
  user: t.field({
    type: UserRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }) => getUser(String(id)),
  }),
  auditEvents: t.field({
    type: AuditEventPageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: AuditEventFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listAuditEvents(args as never),
  }),
}));

builder.mutationFields((t) => ({
  createUser: t.field({
    type: UserRef,
    nullable: false,
    args: { input: t.arg({ type: CreateUserInputRef, required: true }) },
    resolve: (_parent, { input }, context) =>
      createUser(context, {
        ...input,
        role: input.role as Role,
      }),
  }),
  updateUser: t.field({
    type: UserRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateUserInputRef, required: true }),
    },
    resolve: (_parent, { id, input }, context) =>
      updateUser(context, String(id), {
        name: input.name,
        role: (input.role as Role | null | undefined) ?? null,
      }),
  }),
  setUserActive: t.field({
    type: UserRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      active: t.arg.boolean({ required: true }),
    },
    resolve: (_parent, { id, active }, context) =>
      setUserActive(context, String(id), active),
  }),
  resetUserPassword: t.field({
    type: ResetUserPasswordPayloadRef,
    nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }, context) =>
      resetUserPassword(context, String(id)),
  }),
}));

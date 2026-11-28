import type { DeviceKeyView, DeviceView } from "../../auth/device-view.ts";
import {
  approveDevice,
  enrollDevice,
  getDeviceForViewer,
  listDeviceViews,
  listSessionViews,
  type NativeEnrollmentResult,
  revokeDevice,
  revokeSession,
  rotateDeviceKey,
  type SessionView,
} from "../../auth/devices.ts";
import {
  loginNative,
  type NativeAuthResult,
  refreshNative,
} from "../../auth/native.ts";
import type { PasetoPublicKey } from "../../auth/paseto.ts";
import { upgradeOfflineSession } from "../../auth/upgrade.ts";
import { loginWeb, logoutWeb, type WebLoginResult } from "../../auth/web.ts";
import { builder } from "../builder.ts";
import type { ContextUser } from "../context.ts";
import { validationFailed } from "../errors.ts";
import { PageInfoRef, PageInputRef } from "./common.ts";
import { UserRef } from "./user.ts";

interface AuthPayloadShape {
  accessToken: string | null;
  accessExpiresAt: Date | string;
  refreshToken: string | null;
  refreshExpiresAt: Date | string | null;
  offlineToken: string | null;
  offlineExpiresAt: Date | string | null;
  graceUntil: Date | string | null;
  device: DeviceView | null;
  serverTime: Date | string;
  keySet: PasetoPublicKey[];
  user: ContextUser;
}

const PasetoKeyRef = builder.objectRef<PasetoPublicKey>("PasetoKey");
const DeviceKeyRef = builder.objectRef<DeviceKeyView>("DeviceKey");
export const DeviceRef = builder.objectRef<DeviceView>("Device");
const AuthPayloadRef = builder.objectRef<AuthPayloadShape>("AuthPayload");
const SessionRef = builder.objectRef<SessionView>("Session");
const DevicePageRef = builder.objectRef<{
  items: DeviceView[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}>("DevicePage");

const DevicePlatformEnum = builder.enumType("DevicePlatform", {
  values: ["ANDROID", "TAURI"] as const,
});
export const DeviceStatusEnum = builder.enumType("DeviceStatus", {
  values: ["PENDING", "ACTIVE", "REVOKED"] as const,
});
const DeviceKeyStatusEnum = builder.enumType("DeviceKeyStatus", {
  values: ["ACTIVE", "RETIRED", "REVOKED"] as const,
});

const LoginInputRef = builder.inputType("LoginInput", {
  fields: (t) => ({
    username: t.string({ required: true }),
    password: t.string({ required: true }),
  }),
});
const RefreshInputRef = builder.inputType("RefreshInput", {
  fields: (t) => ({
    refreshToken: t.string({ required: true }),
  }),
});
const EnrollDeviceInputRef = builder.inputType("EnrollDeviceInput", {
  fields: (t) => ({
    username: t.string({ required: true }),
    password: t.string({ required: true }),
    name: t.string({ required: true }),
    platform: t.field({ type: DevicePlatformEnum, required: true }),
    keyId: t.string({ required: true }),
    publicKey: t.string({ required: true }),
  }),
});
const UpgradeOfflineSessionInputRef = builder.inputType(
  "UpgradeOfflineSessionInput",
  {
    fields: (t) => ({
      username: t.string({ required: true }),
      password: t.string({ required: true }),
    }),
  },
);
const RotateDeviceKeyInputRef = builder.inputType("RotateDeviceKeyInput", {
  fields: (t) => ({
    deviceId: t.id({ required: true }),
    keyId: t.string({ required: true }),
    publicKey: t.string({ required: true }),
  }),
});
const DeviceFilterRef = builder.inputType("DeviceFilter", {
  fields: (t) => ({
    search: t.string(),
    platform: t.field({ type: DevicePlatformEnum }),
    status: t.field({ type: DeviceStatusEnum }),
  }),
});

PasetoKeyRef.implement({
  fields: (t) => ({
    kid: t.exposeString("kid", { nullable: false }),
    publicKey: t.exposeString("publicKey", { nullable: false }),
    alg: t.exposeString("alg", { nullable: false }),
  }),
});

DeviceKeyRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    deviceId: t.exposeID("deviceId", { nullable: false }),
    keyId: t.exposeString("keyId", { nullable: false }),
    publicKey: t.exposeString("publicKey", { nullable: false }),
    keyAlg: t.exposeString("keyAlg", { nullable: false }),
    status: t.field({
      type: DeviceKeyStatusEnum,
      nullable: false,
      resolve: (key) => key.status,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (key) => key.createdAt,
    }),
    activatedAt: t.field({
      type: "DateTime",
      resolve: (key) => key.activatedAt,
    }),
    retiredAt: t.field({ type: "DateTime", resolve: (key) => key.retiredAt }),
    acceptedUntil: t.field({
      type: "DateTime",
      resolve: (key) => key.acceptedUntil,
    }),
    revokedAt: t.field({ type: "DateTime", resolve: (key) => key.revokedAt }),
  }),
});

DeviceRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    name: t.exposeString("name", { nullable: false }),
    platform: t.field({
      type: DevicePlatformEnum,
      nullable: false,
      resolve: (device) => device.platform,
    }),
    status: t.field({
      type: DeviceStatusEnum,
      nullable: false,
      resolve: (device) => device.status,
    }),
    enrolledBy: t.field({
      type: UserRef,
      nullable: false,
      resolve: (device) => device.enrolledBy,
    }),
    enrolledAt: t.field({
      type: "DateTime",
      resolve: (device) => device.enrolledAt,
    }),
    lastSeenAt: t.field({
      type: "DateTime",
      resolve: (device) => device.lastSeenAt,
    }),
    revokedAt: t.field({
      type: "DateTime",
      resolve: (device) => device.revokedAt,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (device) => device.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (device) => device.updatedAt,
    }),
    keys: t.field({
      type: [DeviceKeyRef],
      nullable: false,
      resolve: (device) => device.keys,
    }),
  }),
});

SessionRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    user: t.field({
      type: UserRef,
      nullable: false,
      resolve: (session) => session.user,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (session) => session.createdAt,
    }),
    expiresAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (session) => session.expiresAt,
    }),
    lastSeenAt: t.field({
      type: "DateTime",
      resolve: (session) => session.lastSeenAt,
    }),
    revokedAt: t.field({
      type: "DateTime",
      resolve: (session) => session.revokedAt,
    }),
    userAgent: t.exposeString("userAgent"),
    ip: t.exposeString("ip"),
  }),
});

DevicePageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [DeviceRef],
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

AuthPayloadRef.implement({
  fields: (t) => ({
    accessToken: t.exposeString("accessToken"),
    accessExpiresAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (payload) => payload.accessExpiresAt,
    }),
    refreshToken: t.exposeString("refreshToken"),
    refreshExpiresAt: t.field({
      type: "DateTime",
      resolve: (payload) => payload.refreshExpiresAt,
    }),
    offlineToken: t.exposeString("offlineToken"),
    offlineExpiresAt: t.field({
      type: "DateTime",
      resolve: (payload) => payload.offlineExpiresAt,
    }),
    graceUntil: t.field({
      type: "DateTime",
      resolve: (payload) => payload.graceUntil,
    }),
    device: t.field({
      type: DeviceRef,
      resolve: (payload) => payload.device,
    }),
    serverTime: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (payload) => payload.serverTime,
    }),
    keySet: t.field({
      type: [PasetoKeyRef],
      nullable: false,
      resolve: (payload) => payload.keySet,
    }),
    user: t.field({
      type: UserRef,
      nullable: false,
      resolve: (payload) => payload.user,
    }),
  }),
});

function authPayloadFromWeb(
  result: WebLoginResult,
  keySet: PasetoPublicKey[],
): AuthPayloadShape {
  return {
    accessToken: null,
    accessExpiresAt: result.expiresAt,
    refreshToken: null,
    refreshExpiresAt: null,
    offlineToken: null,
    offlineExpiresAt: null,
    graceUntil: null,
    device: null,
    serverTime: result.serverTime,
    keySet,
    user: result.user,
  };
}

function authPayloadFromNative(result: NativeAuthResult): AuthPayloadShape {
  return {
    accessToken: result.accessToken,
    accessExpiresAt: result.accessExpiresAt,
    refreshToken: result.refreshToken,
    refreshExpiresAt: result.refreshExpiresAt,
    offlineToken: result.offlineToken,
    offlineExpiresAt: result.offlineExpiresAt,
    graceUntil: result.graceUntil,
    device: result.device,
    serverTime: result.serverTime,
    keySet: result.keySet,
    user: result.user,
  };
}

function authPayloadFromEnrollment(
  result: NativeEnrollmentResult,
  keySet: PasetoPublicKey[],
): AuthPayloadShape {
  return {
    accessToken: null,
    accessExpiresAt: result.serverTime,
    refreshToken: null,
    refreshExpiresAt: null,
    offlineToken: null,
    offlineExpiresAt: null,
    graceUntil: null,
    device: result.device,
    serverTime: result.serverTime,
    keySet,
    user: result.user,
  };
}

builder.queryFields((t) => ({
  device: t.field({
    type: DeviceRef,
    args: {
      deviceId: t.arg.id({ required: true }),
    },
    resolve: (_parent, { deviceId }, context) =>
      getDeviceForViewer(context, String(deviceId)),
  }),
  devices: t.field({
    type: DevicePageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: DeviceFilterRef }),
      page: t.arg({ type: PageInputRef }),
    },
    resolve: async (_parent, { filter, page }, context) => {
      void context;
      const pageNumber = Math.max(1, page?.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, page?.pageSize ?? 20));
      const result = await listDeviceViews({
        search: filter?.search,
        platform: filter?.platform,
        status: filter?.status,
        page: pageNumber,
        pageSize,
      });
      return {
        items: result.items,
        pageInfo: {
          page: pageNumber,
          pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / pageSize),
        },
      };
    },
  }),
  sessions: t.field({
    type: [SessionRef],
    nullable: false,
    resolve: () => listSessionViews(),
  }),
}));

builder.mutationType({
  fields: (t) => ({
    login: t.field({
      type: AuthPayloadRef,
      nullable: false,
      args: {
        input: t.arg({ type: LoginInputRef, required: true }),
      },
      resolve: async (_parent, { input }, context) => {
        const platform = context.clientPlatform?.toUpperCase();
        if (platform === "WEB") {
          return authPayloadFromWeb(
            await loginWeb(context, input),
            context.auth.paseto.keySet,
          );
        }
        if (platform === "ANDROID" || platform === "TAURI") {
          return authPayloadFromNative(await loginNative(context, input));
        }
        throw validationFailed("X-Client-Platform tidak dikenal.");
      },
    }),
    refresh: t.field({
      type: AuthPayloadRef,
      nullable: false,
      args: {
        input: t.arg({ type: RefreshInputRef, required: true }),
      },
      resolve: async (_parent, { input }, context) =>
        authPayloadFromNative(await refreshNative(context, input)),
    }),
    logout: t.boolean({
      nullable: false,
      resolve: async (_parent, _args, context) => logoutWeb(context),
    }),
    enrollDevice: t.field({
      type: AuthPayloadRef,
      nullable: false,
      args: {
        input: t.arg({ type: EnrollDeviceInputRef, required: true }),
      },
      resolve: async (_parent, { input }, context) =>
        authPayloadFromEnrollment(
          await enrollDevice(context, input),
          context.auth.paseto.keySet,
        ),
    }),
    approveDevice: t.field({
      type: DeviceRef,
      nullable: false,
      args: {
        deviceId: t.arg.id({ required: true }),
      },
      resolve: (_parent, { deviceId }, context) =>
        approveDevice(context, String(deviceId)),
    }),
    revokeDevice: t.field({
      type: DeviceRef,
      nullable: false,
      args: {
        deviceId: t.arg.id({ required: true }),
      },
      resolve: (_parent, { deviceId }, context) =>
        revokeDevice(context, String(deviceId)),
    }),
    rotateDeviceKey: t.field({
      type: DeviceRef,
      nullable: false,
      args: {
        input: t.arg({ type: RotateDeviceKeyInputRef, required: true }),
      },
      resolve: (_parent, { input }, context) =>
        rotateDeviceKey(
          context,
          input as {
            deviceId: string;
            keyId: string;
            publicKey: string;
          },
        ),
    }),
    upgradeOfflineSession: t.field({
      type: AuthPayloadRef,
      nullable: false,
      args: {
        input: t.arg({ type: UpgradeOfflineSessionInputRef, required: true }),
      },
      resolve: async (_parent, { input }, context) =>
        authPayloadFromNative(await upgradeOfflineSession(context, input)),
    }),
    revokeSession: t.boolean({
      nullable: false,
      args: {
        sessionId: t.arg.id({ required: true }),
      },
      resolve: (_parent, { sessionId }, context) =>
        revokeSession(context, String(sessionId)),
    }),
  }),
});

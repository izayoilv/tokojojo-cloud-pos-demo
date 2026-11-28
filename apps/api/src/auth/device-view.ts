import type { ContextUser } from "../graphql/context.ts";
import {
  type DeviceKeyRow,
  type DeviceRow,
  findDeviceById,
  findUserById,
  listDeviceKeys,
} from "./repository.ts";
import { userRowToContextUser } from "./user-mapper.ts";

export interface DeviceKeyView {
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

export interface DeviceView {
  id: string;
  name: string;
  platform: "ANDROID" | "TAURI";
  status: "PENDING" | "ACTIVE" | "REVOKED";
  enrolledBy: ContextUser;
  enrolledAt: Date | null;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  keys: DeviceKeyView[];
}

export function deviceKeyView(key: DeviceKeyRow): DeviceKeyView {
  return {
    id: key.id,
    deviceId: key.deviceId,
    keyId: key.keyId,
    publicKey: key.publicKey,
    keyAlg: key.keyAlg,
    status: key.status,
    createdAt: key.createdAt,
    activatedAt: key.activatedAt,
    retiredAt: key.retiredAt,
    acceptedUntil: key.acceptedUntil,
    revokedAt: key.revokedAt,
  };
}

export function deviceView(
  device: DeviceRow,
  enrolledBy: ContextUser,
  keys: DeviceKeyRow[],
): DeviceView {
  return {
    id: device.id,
    name: device.name,
    platform: device.platform,
    status: device.status,
    enrolledBy,
    enrolledAt: device.enrolledAt,
    lastSeenAt: device.lastSeenAt,
    revokedAt: device.revokedAt,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    keys: keys.map(deviceKeyView),
  };
}

export async function loadDeviceView(
  deviceId: string,
): Promise<DeviceView | null> {
  const device = await findDeviceById(deviceId);
  if (!device) return null;

  const [user, keys] = await Promise.all([
    findUserById(device.enrolledByUserId),
    listDeviceKeys(device.id),
  ]);
  if (!user) return null;

  return deviceView(device, userRowToContextUser(user, null), keys);
}

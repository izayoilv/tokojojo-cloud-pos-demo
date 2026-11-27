import {
  verifyDeviceSignature,
  verifyPerOrderSignature,
} from "../auth/device-signature.ts";
import { hasPermission } from "../auth/permissions.ts";
import {
  findSaleIdByDeviceClientOrder,
  findSyncBatch,
  findUserById,
  getSqlClient,
  insertAuditEvent,
  insertDeviceEvent,
  insertSyncBatch,
  latestOfflineTokenForDevice,
  offlineTokenForDeviceAt,
  type SyncBatchRow,
  touchDevice,
  updateSyncBatchCounts,
} from "../auth/repository.ts";
import { userRowToContextUser } from "../auth/user-mapper.ts";
import type { RequestContext } from "../graphql/context.ts";
import { apiError, validationFailed } from "../graphql/errors.ts";
import { createSale, getShift } from "../sales/service.ts";
import { canonicalJson, optional, sha256Hex } from "./canonical.ts";

const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 100;

function maxSyncOrders(): number {
  const configured = Number(process.env.OFFLINE_SYNC_MAX_ORDERS);
  return Number.isInteger(configured) && configured > 0
    ? Math.min(MAX_BATCH_LIMIT, configured)
    : DEFAULT_BATCH_LIMIT;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_HASH_PATTERN = /^[0-9a-f]{64}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export interface SyncShiftInputView {
  id: string;
  userId: string;
  openingCash: string;
  openedAtClient: string;
  closedAtClient?: string | null;
  expectedCash?: string | null;
  actualCash?: string | null;
}

export interface SyncOrderItemInputView {
  productId: string;
  productUnitId: string;
  qty: string;
  unitPrice: string;
}

export interface SyncOrderPaymentInputView {
  method: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
  amount: string;
  cashReceived?: string | null;
  paymentRef?: string | null;
}

export interface SyncOrderInputView {
  clientOrderId: string;
  clientSeq: string;
  clientCreatedAt: string;
  shiftId: string;
  customerId?: string | null;
  items: SyncOrderItemInputView[];
  payments: SyncOrderPaymentInputView[];
  signature: string;
}

export interface SyncOfflineBatchInputView {
  clientBatchId: string;
  batchHash: string;
  shifts: SyncShiftInputView[];
  orders: SyncOrderInputView[];
}

export interface SyncItemResultView {
  clientId: string;
  status: "ACCEPTED" | "DUPLICATE" | "FLAGGED" | "REJECTED";
  serverId: string | null;
  code: string | null;
  message: string | null;
}

export interface SyncOfflineBatchPayloadView {
  batchId: string;
  shifts: SyncItemResultView[];
  orders: SyncItemResultView[];
}

export interface SyncBatchView {
  id: string;
  deviceId: string;
  clientBatchId: string;
  batchHash: string;
  receivedAt: Date | string;
  acceptedCount: number;
  flaggedCount: number;
  rejectedCount: number;
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const extensions = (error as { extensions?: { code?: unknown } })
      .extensions;
    if (typeof extensions?.code === "string") return extensions.code;
  }
  return "SYNC_REJECTED";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Sinkronisasi gagal.";
}

function shiftCanonical(input: SyncShiftInputView) {
  return {
    id: input.id,
    userId: input.userId,
    openingCash: input.openingCash,
    openedAtClient: input.openedAtClient,
    ...(optional(input.closedAtClient)
      ? { closedAtClient: input.closedAtClient }
      : {}),
    ...(optional(input.expectedCash)
      ? { expectedCash: input.expectedCash }
      : {}),
    ...(optional(input.actualCash) ? { actualCash: input.actualCash } : {}),
  };
}

function orderCanonical(input: SyncOrderInputView, userId?: string) {
  return {
    clientOrderId: input.clientOrderId,
    clientSeq: input.clientSeq,
    clientCreatedAt: input.clientCreatedAt,
    shiftId: input.shiftId,
    ...(optional(input.customerId) ? { customerId: input.customerId } : {}),
    items: input.items.map((item) => ({
      productId: item.productId,
      productUnitId: item.productUnitId,
      qty: item.qty,
      unitPrice: item.unitPrice,
    })),
    payments: input.payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      ...(optional(payment.cashReceived)
        ? { cashReceived: payment.cashReceived }
        : {}),
      ...(optional(payment.paymentRef)
        ? { paymentRef: payment.paymentRef }
        : {}),
    })),
    ...(userId ? { userId } : {}),
    signature: input.signature,
  };
}

function batchCanonical(input: SyncOfflineBatchInputView) {
  return {
    clientBatchId: input.clientBatchId,
    shifts: input.shifts.map(shiftCanonical),
    orders: input.orders.map((order) => orderCanonical(order)),
  };
}

function orderSigningBytes(input: SyncOrderInputView, userId: string): string {
  const order = orderCanonical(input, userId) as Record<string, unknown>;
  delete order.signature;
  return canonicalJson(order);
}

async function duplicateBatchResults(
  input: SyncOfflineBatchInputView,
  existing: SyncBatchRow,
): Promise<SyncOfflineBatchPayloadView> {
  const client = await getSqlClient();
  const shiftIds = input.shifts
    .map((shift) => shift.id)
    .filter((id) => isUuid(id));
  const orderIds = input.orders
    .map((order) => order.clientOrderId)
    .filter((id) => isUuid(id));
  const shiftRows =
    shiftIds.length > 0
      ? ((await client`
          select id from cashier_shifts
          where device_id = ${existing.deviceId}
            and id = any(${shiftIds}::uuid[])`) as Array<{ id: string }>)
      : [];
  const saleRows =
    orderIds.length > 0
      ? ((await client`
          select id, client_order_id from sales
          where device_id = ${existing.deviceId}
            and client_order_id = any(${orderIds}::uuid[])`) as Array<{
          id: string;
          client_order_id: string;
        }>)
      : [];
  const salesByClientOrder = new Map(
    saleRows.map((sale) => [sale.client_order_id, sale.id]),
  );

  const shifts: SyncItemResultView[] = input.shifts.map((shift) => ({
    clientId: shift.id,
    status: "DUPLICATE",
    serverId: shiftRows.some((row) => row.id === shift.id) ? shift.id : null,
    code: null,
    message: "Batch sudah pernah diproses.",
  }));
  const orders: SyncItemResultView[] = input.orders.map((order) => ({
    clientId: order.clientOrderId,
    status: "DUPLICATE",
    serverId: salesByClientOrder.get(order.clientOrderId) ?? null,
    code: "DUPLICATE_ORDER",
    message: "Batch sudah pernah diproses.",
  }));
  return { batchId: existing.id, shifts, orders };
}

async function processShift(
  context: RequestContext,
  deviceId: string,
  devicePlatform: "ANDROID" | "TAURI",
  input: SyncShiftInputView,
): Promise<SyncItemResultView> {
  if (!isUuid(input.id) || !isUuid(input.userId)) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: "VALIDATION_FAILED",
      message: "id atau userId shift tidak valid.",
    };
  }

  const client = await getSqlClient();
  const [existing] = await client`
    select id, device_id, user_id, status from cashier_shifts
    where id = ${input.id} limit 1`;
  if (existing) {
    if (
      optional(input.closedAtClient) !== undefined &&
      existing.status === "OPEN"
    ) {
      if (
        existing.device_id !== deviceId ||
        existing.user_id !== input.userId
      ) {
        return {
          clientId: input.id,
          status: "REJECTED",
          serverId: existing.id,
          code: "INVALID_SHIFT",
          message: "Shift id dipakai perangkat atau pengguna lain.",
        };
      }
      const closedAt = new Date(input.closedAtClient!);
      const actualCash = Number(input.actualCash);
      const expectedCash =
        input.expectedCash === undefined || input.expectedCash === null
          ? Number(input.openingCash)
          : Number(input.expectedCash);
      if (
        Number.isNaN(closedAt.getTime()) ||
        !Number.isInteger(actualCash) ||
        actualCash < 0 ||
        !Number.isInteger(expectedCash) ||
        expectedCash < 0
      ) {
        return {
          clientId: input.id,
          status: "REJECTED",
          serverId: existing.id,
          code: "INVALID_SHIFT",
          message: "Data penutupan shift tidak valid.",
        };
      }
      await client`
        update cashier_shifts
        set
          status = 'CLOSED',
          closed_at = now(),
          expected_cash = ${expectedCash},
          actual_cash = ${actualCash},
          closed_at_client = ${closedAt.toISOString()}::timestamptz,
          updated_at = now()
        where id = ${input.id}`;
      await insertAuditEvent(client, {
        eventType: "SHIFT_CLOSED",
        actorUserId: input.userId,
        deviceId,
        entityType: "cashier_shift",
        entityId: input.id,
        metadata: { source: "OFFLINE", platform: devicePlatform },
      });
      return {
        clientId: input.id,
        status: "ACCEPTED",
        serverId: existing.id,
        code: null,
        message: null,
      };
    }
    return {
      clientId: input.id,
      status: "DUPLICATE",
      serverId: existing.id,
      code: null,
      message: null,
    };
  }

  const user = await findUserById(input.userId);
  if (!user) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: "INVALID_SHIFT",
      message: "Pengguna shift tidak ditemukan.",
    };
  }
  if (!user.isActive) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: "USER_DISABLED",
      message: "Pengguna shift dinonaktifkan.",
    };
  }
  if (!hasPermission(user.role, "shifts:write")) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: "FORBIDDEN",
      message: "Pengguna shift tidak berwenang.",
    };
  }

  const [otherOpen] = await client`
    select id from cashier_shifts
    where user_id = ${input.userId} and status = 'OPEN' and id <> ${input.id}
    limit 1`;
  if (otherOpen) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: "INVALID_SHIFT",
      message: "Pengguna sudah memiliki shift terbuka.",
    };
  }

  const openingCash = Number(input.openingCash);
  if (!Number.isInteger(openingCash) || openingCash < 0) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: "VALIDATION_FAILED",
      message: "openingCash tidak valid.",
    };
  }
  const openedAt = new Date(input.openedAtClient);
  if (Number.isNaN(openedAt.getTime())) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: "VALIDATION_FAILED",
      message: "openedAtClient tidak valid.",
    };
  }

  const isClose = optional(input.closedAtClient) !== undefined;
  const closedAt = isClose ? new Date(input.closedAtClient!) : null;
  if (isClose && Number.isNaN(closedAt!.getTime())) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: "VALIDATION_FAILED",
      message: "closedAtClient tidak valid.",
    };
  }
  const actualCash =
    isClose && input.actualCash !== undefined && input.actualCash !== null
      ? Number(input.actualCash)
      : null;
  if (
    isClose &&
    (actualCash === null || !Number.isInteger(actualCash) || actualCash < 0)
  ) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: "INVALID_SHIFT",
      message: "actualCash tidak valid.",
    };
  }
  const expectedCash = isClose
    ? input.expectedCash === undefined || input.expectedCash === null
      ? openingCash
      : Number(input.expectedCash)
    : null;
  if (
    isClose &&
    (expectedCash === null ||
      !Number.isInteger(expectedCash) ||
      expectedCash < 0)
  ) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: "INVALID_SHIFT",
      message: "expectedCash tidak valid.",
    };
  }

  try {
    const [row] = await client`
      insert into cashier_shifts (
        id, user_id, status, opened_at, closed_at, opening_cash,
        expected_cash, actual_cash, device_id, source, opened_at_client,
        closed_at_client, received_at
      )
      values (
        ${input.id}, ${input.userId},
        ${isClose ? "CLOSED" : "OPEN"},
        now(),
        ${closedAt ? new Date().toISOString() : null}::timestamptz,
        ${openingCash},
        ${expectedCash}, ${actualCash}, ${deviceId}, 'OFFLINE',
        ${openedAt.toISOString()}::timestamptz,
        ${closedAt ? closedAt.toISOString() : null}::timestamptz,
        now()
      )
      returning id`;

    await insertAuditEvent(client, {
      eventType: isClose ? "SHIFT_CLOSED" : "SHIFT_OPENED",
      actorUserId: input.userId,
      deviceId,
      entityType: "cashier_shift",
      entityId: row.id,
      metadata: { source: "OFFLINE", platform: devicePlatform },
    });

    return {
      clientId: input.id,
      status: "ACCEPTED",
      serverId: row.id,
      code: null,
      message: null,
    };
  } catch (error) {
    return {
      clientId: input.id,
      status: "REJECTED",
      serverId: null,
      code: errorCode(error),
      message: errorMessage(error),
    };
  }
}

export async function syncOfflineBatch(
  context: RequestContext,
  input: SyncOfflineBatchInputView,
): Promise<SyncOfflineBatchPayloadView> {
  const platform = context.clientPlatform?.toUpperCase();
  if (platform !== "TAURI") {
    throw validationFailed("Sinkronisasi offline hanya tersedia untuk TAURI.");
  }
  const ip = context.ip ?? "unknown";
  const deviceRateKey = context.deviceId ?? "unknown";
  if (!context.auth.syncRateLimit.check(ip, deviceRateKey)) {
    throw apiError("RATE_LIMITED");
  }
  context.auth.syncRateLimit.recordFailure(ip, deviceRateKey);

  if (!isUuid(input.clientBatchId)) {
    throw validationFailed("clientBatchId tidak valid.");
  }
  if (!BATCH_HASH_PATTERN.test(input.batchHash)) {
    throw validationFailed("batchHash tidak valid.");
  }
  const batchLimit = maxSyncOrders();
  if (input.orders.length > batchLimit) {
    throw apiError("QUEUE_LIMIT");
  }
  if (input.shifts.length > batchLimit) {
    throw apiError("QUEUE_LIMIT");
  }

  const computedHash = sha256Hex(canonicalJson(batchCanonical(input)));
  if (computedHash.toLowerCase() !== input.batchHash.toLowerCase()) {
    throw apiError("INVALID_SIGNATURE");
  }

  const proof = await verifyDeviceSignature(
    context,
    "syncOfflineBatch",
    input.batchHash,
  );
  if (proof.device.status !== "ACTIVE") {
    throw proof.device.status === "PENDING"
      ? apiError("DEVICE_PENDING")
      : apiError("DEVICE_REVOKED");
  }
  if (proof.device.platform !== "TAURI") {
    throw validationFailed(
      "Perangkat ini tidak mendukung sinkronisasi offline.",
    );
  }

  const client = await getSqlClient();
  const existing = await findSyncBatch(proof.device.id, input.clientBatchId);
  if (existing) {
    if (existing.batchHash.toLowerCase() !== input.batchHash.toLowerCase()) {
      throw apiError("CONFLICT", "clientBatchId sudah dipakai batch lain.");
    }
    return duplicateBatchResults(input, existing);
  }

  let batch: SyncBatchRow;
  try {
    batch = await insertSyncBatch(client, {
      deviceId: proof.device.id,
      clientBatchId: input.clientBatchId,
      batchHash: input.batchHash,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      const raced = await findSyncBatch(proof.device.id, input.clientBatchId);
      if (raced) {
        if (raced.batchHash.toLowerCase() !== input.batchHash.toLowerCase()) {
          throw apiError("CONFLICT", "clientBatchId sudah dipakai batch lain.");
        }
        return duplicateBatchResults(input, raced);
      }
    }
    throw error;
  }

  const shiftResults: SyncItemResultView[] = [];
  for (const shift of input.shifts) {
    const result = await processShift(
      context,
      proof.device.id,
      proof.device.platform,
      shift,
    );
    shiftResults.push(result);
    if (result.status === "REJECTED") {
      await rejectShift(proof, shift, batch.id, result.code ?? "INVALID_SHIFT");
    }
  }

  const orderResults: SyncItemResultView[] = [];
  for (const order of input.orders) {
    orderResults.push(await processOrder(context, proof, order, batch.id));
  }

  const accepted = [...shiftResults, ...orderResults].filter(
    (item) => item.status === "ACCEPTED",
  ).length;
  const flagged = [...shiftResults, ...orderResults].filter(
    (item) => item.status === "FLAGGED",
  ).length;
  const rejected = [...shiftResults, ...orderResults].filter(
    (item) => item.status === "REJECTED",
  ).length;

  await updateSyncBatchCounts(client, batch.id, {
    accepted,
    flagged,
    rejected,
  });
  await touchDevice(client, proof.device.id, context.auth.now());
  await insertAuditEvent(client, {
    eventType: "SYNC_COMPLETED",
    actorUserId: proof.device.enrolledByUserId,
    deviceId: proof.device.id,
    entityType: "sync_batch",
    entityId: batch.id,
    metadata: { accepted, flagged, rejected },
  });

  return {
    batchId: batch.id,
    shifts: shiftResults,
    orders: orderResults,
  };
}

async function processOrder(
  context: RequestContext,
  proof: Awaited<ReturnType<typeof verifyDeviceSignature>>,
  order: SyncOrderInputView,
  batchId: string,
): Promise<SyncItemResultView> {
  const validIds =
    isUuid(order.clientOrderId) &&
    isUuid(order.shiftId) &&
    (order.customerId === undefined ||
      order.customerId === null ||
      isUuid(order.customerId)) &&
    order.items.every(
      (item) => isUuid(item.productId) && isUuid(item.productUnitId),
    );
  if (!validIds) {
    await rejectOrder(context, proof, order, batchId, "VALIDATION_FAILED");
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code: "VALIDATION_FAILED",
      message: "ID pesanan tidak valid.",
    };
  }

  const client = await getSqlClient();
  const existingSale = await findSaleIdByDeviceClientOrder(
    proof.device.id,
    order.clientOrderId,
  );
  if (existingSale) {
    return {
      clientId: order.clientOrderId,
      status: "DUPLICATE",
      serverId: existingSale,
      code: "DUPLICATE_ORDER",
      message: null,
    };
  }

  const shift = await getShift(order.shiftId);
  if (!shift || shift.deviceId !== proof.device.id) {
    await rejectOrder(context, proof, order, batchId, "SHIFT_SYNC_REQUIRED");
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code: "SHIFT_SYNC_REQUIRED",
      message: "Shift harus disinkronkan terlebih dahulu.",
    };
  }

  const cashier = await findUserById(shift.userId);
  if (!cashier) {
    await rejectOrder(context, proof, order, batchId, "INVALID_SHIFT");
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code: "INVALID_SHIFT",
      message: "Kasir shift tidak ditemukan.",
    };
  }
  if (!cashier.isActive) {
    await rejectOrder(context, proof, order, batchId, "USER_DISABLED");
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code: "USER_DISABLED",
      message: "Kasir shift dinonaktifkan.",
    };
  }
  if (!hasPermission(cashier.role, "sales:create")) {
    await rejectOrder(context, proof, order, batchId, "FORBIDDEN");
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code: "FORBIDDEN",
      message: "Kasir shift tidak berwenang membuat penjualan.",
    };
  }

  try {
    const canonical = orderSigningBytes(order, cashier.id);
    await verifyPerOrderSignature({
      deviceId: proof.device.id,
      signature: order.signature,
      canonical,
      now: context.auth.now(),
    });
  } catch (error) {
    const code = errorCode(error);
    await rejectOrder(context, proof, order, batchId, code);
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code,
      message: errorMessage(error),
    };
  }

  if (order.payments.some((payment) => payment.method !== "CASH")) {
    await rejectOrder(context, proof, order, batchId, "VALIDATION_FAILED");
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code: "VALIDATION_FAILED",
      message: "Pembayaran offline hanya menerima CASH.",
    };
  }

  const clientCreatedAt = new Date(order.clientCreatedAt);
  if (Number.isNaN(clientCreatedAt.getTime())) {
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code: "VALIDATION_FAILED",
      message: "clientCreatedAt tidak valid.",
    };
  }

  const token = await offlineTokenForDeviceAt(proof.device.id, clientCreatedAt);
  if (!token || token.revokedAt) {
    await rejectOrder(context, proof, order, batchId, "OFFLINE_TOKEN_EXPIRED");
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code: "OFFLINE_TOKEN_EXPIRED",
      message: "Token offline tidak tersedia atau sudah tidak berlaku.",
    };
  }
  if (!token.scope.includes("sales:create")) {
    await rejectOrder(context, proof, order, batchId, "FORBIDDEN");
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code: "FORBIDDEN",
      message: "Token offline tidak memiliki akses penjualan.",
    };
  }
  if (clientCreatedAt.getTime() > new Date(token.graceUntil).getTime()) {
    await rejectOrder(context, proof, order, batchId, "GRACE_EXPIRED");
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code: "GRACE_EXPIRED",
      message: "Masa tenggang offline sudah berakhir.",
    };
  }
  const source =
    clientCreatedAt.getTime() <= new Date(token.expiresAt).getTime()
      ? "OFFLINE"
      : "GRACE";
  const shiftClosedAt = shift.closedAtClient ?? shift.closedAt;
  const closedMismatch =
    shiftClosedAt !== null &&
    clientCreatedAt.getTime() > new Date(shiftClosedAt).getTime();

  const saleUser = userRowToContextUser(cashier, null);
  const saleContext: RequestContext = {
    ...context,
    user: saleUser,
    role: cashier.role,
    device: {
      id: proof.device.id,
      platform: proof.device.platform,
      status: proof.device.status,
    },
    authKind: "native",
    authFailure: null,
    session: null,
  };

  try {
    const result = await createSale(
      saleContext,
      {
        shiftId: order.shiftId,
        customerId: order.customerId ?? null,
        items: order.items.map((item) => ({
          productId: item.productId,
          productUnitId: item.productUnitId,
          qty: item.qty,
          unitPrice: item.unitPrice,
        })),
        payments: order.payments.map((payment) => ({
          method: payment.method,
          amount: payment.amount,
          cashReceived: payment.cashReceived ?? null,
          paymentRef: payment.paymentRef ?? null,
        })),
        clientOrderId: order.clientOrderId,
        clientSeq: order.clientSeq,
        clientCreatedAt: order.clientCreatedAt,
        signature: order.signature,
      },
      {
        allowClosedShift: true,
        source,
        signatureVerified: true,
        syncBatchId: batchId,
      },
    );

    if (result.duplicate) {
      return {
        clientId: order.clientOrderId,
        status: "DUPLICATE",
        serverId: result.sale.id,
        code: "DUPLICATE_ORDER",
        message: null,
      };
    }

    const priceVariance = Number(result.sale.priceVariance);
    const flagReasons: string[] = [];
    if (source === "GRACE") flagReasons.push("GRACE");
    if (closedMismatch) flagReasons.push("SHIFT_CLOSED");
    if (Number.isFinite(priceVariance) && priceVariance !== 0) {
      flagReasons.push("PRICE_VARIANCE");
    }

    if (flagReasons.length > 0) {
      const code =
        closedMismatch && source !== "GRACE" ? "SHIFT_CLOSED" : "ORDER_FLAGGED";
      const deviceEventType =
        source === "GRACE" ? "GRACE_ORDER_FLAGGED" : "ORDER_FLAGGED";
      await client.begin(async (transaction) => {
        await insertAuditEvent(transaction, {
          eventType: "SYNC_ORDER_FLAGGED",
          actorUserId: cashier.id,
          deviceId: proof.device.id,
          entityType: "sale",
          entityId: result.sale.id,
          metadata: {
            batchId,
            code,
            source,
            reasons: flagReasons,
            priceVariance: result.sale.priceVariance,
          },
        });
        await insertDeviceEvent(transaction, {
          deviceId: proof.device.id,
          type: deviceEventType,
          actorUserId: cashier.id,
          metadata: {
            batchId,
            clientOrderId: order.clientOrderId,
            reasons: flagReasons,
          },
        });
      });
      return {
        clientId: order.clientOrderId,
        status: "FLAGGED",
        serverId: result.sale.id,
        code,
        message:
          source === "GRACE"
            ? "Pesanan dibuat dalam masa grace dan ditandai untuk review."
            : closedMismatch
              ? "Pesanan dibuat setelah shift ditutup dan ditandai untuk review."
              : "Harga pesanan berbeda dari katalog dan ditandai untuk review.",
      };
    }

    return {
      clientId: order.clientOrderId,
      status: "ACCEPTED",
      serverId: result.sale.id,
      code: null,
      message: null,
    };
  } catch (error) {
    const code = errorCode(error);
    await rejectOrder(context, proof, order, batchId, code);
    return {
      clientId: order.clientOrderId,
      status: "REJECTED",
      serverId: null,
      code,
      message: errorMessage(error),
    };
  }
}

async function rejectShift(
  proof: Awaited<ReturnType<typeof verifyDeviceSignature>>,
  shift: SyncShiftInputView,
  batchId: string,
  code: string,
): Promise<void> {
  const client = await getSqlClient();
  await client.begin(async (transaction) => {
    await insertAuditEvent(transaction, {
      eventType: "SYNC_SHIFT_REJECTED",
      actorUserId: proof.device.enrolledByUserId,
      deviceId: proof.device.id,
      entityType: "sync_shift",
      metadata: {
        batchId,
        shiftId: shift.id,
        userId: shift.userId,
        code,
      },
    });
    await insertDeviceEvent(transaction, {
      deviceId: proof.device.id,
      type: "SYNC_QUARANTINE",
      actorUserId: proof.device.enrolledByUserId,
      metadata: {
        batchId,
        shiftId: shift.id,
        userId: shift.userId,
        code,
      },
    });
  });
}

async function rejectOrder(
  context: RequestContext,
  proof: Awaited<ReturnType<typeof verifyDeviceSignature>>,
  order: SyncOrderInputView,
  batchId: string,
  code: string,
): Promise<void> {
  const client = await getSqlClient();
  await client.begin(async (transaction) => {
    await insertAuditEvent(transaction, {
      eventType: "SYNC_ORDER_REJECTED",
      actorUserId: proof.device.enrolledByUserId,
      deviceId: proof.device.id,
      entityType: "sync_order",
      metadata: {
        batchId,
        clientOrderId: order.clientOrderId,
        shiftId: order.shiftId,
        code,
      },
    });
    await insertDeviceEvent(transaction, {
      deviceId: proof.device.id,
      type: "SYNC_QUARANTINE",
      actorUserId: proof.device.enrolledByUserId,
      metadata: {
        batchId,
        clientOrderId: order.clientOrderId,
        shiftId: order.shiftId,
        code,
      },
    });
  });
}

export async function getSyncBatchForDevice(
  deviceId: string,
): Promise<SyncBatchView | null> {
  const client = await getSqlClient();
  const [row] = await client`
    select
      id, device_id, client_batch_id, batch_hash, received_at,
      accepted_count, flagged_count, rejected_count
    from sync_batches
    where device_id = ${deviceId}
    order by received_at desc, id desc
    limit 1`;
  if (!row) return null;
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

export interface SyncStatusView {
  serverTime: Date;
  deviceStatus: "PENDING" | "ACTIVE" | "REVOKED" | null;
  offlineExpiresAt: Date | null;
  graceUntil: Date | null;
  lastSyncAt: Date | null;
  lastBatch: SyncBatchView | null;
}

export async function getSyncStatus(
  context: RequestContext,
): Promise<SyncStatusView> {
  const serverTime = context.auth.now();
  if (!context.device) {
    return {
      serverTime,
      deviceStatus: null,
      offlineExpiresAt: null,
      graceUntil: null,
      lastSyncAt: null,
      lastBatch: null,
    };
  }

  const [token, batch] = await Promise.all([
    latestOfflineTokenForDevice(context.device.id),
    getSyncBatchForDevice(context.device.id),
  ]);
  return {
    serverTime,
    deviceStatus: context.device.status,
    offlineExpiresAt: token?.expiresAt ?? null,
    graceUntil: token?.graceUntil ?? null,
    lastSyncAt: batch ? new Date(batch.receivedAt) : null,
    lastBatch: batch,
  };
}

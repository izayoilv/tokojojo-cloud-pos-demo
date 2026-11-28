import type {
  SyncBatchView,
  SyncItemResultView,
  SyncOfflineBatchPayloadView,
  SyncStatusView,
} from "../../sync/service.ts";
import { getSyncStatus, syncOfflineBatch } from "../../sync/service.ts";
import { builder } from "../builder.ts";
import { DeviceStatusEnum } from "./auth.ts";
import { SyncItemStatusEnum } from "./domain.ts";
import { SalePaymentInputRef } from "./sales.ts";

const SyncItemResultRef =
  builder.objectRef<SyncItemResultView>("SyncItemResult");
const SyncOfflineBatchPayloadRef =
  builder.objectRef<SyncOfflineBatchPayloadView>("SyncOfflineBatchPayload");
const SyncBatchRef = builder.objectRef<SyncBatchView>("SyncBatch");
const SyncStatusRef = builder.objectRef<SyncStatusView>("SyncStatus");

const SyncShiftInputRef = builder.inputType("SyncShiftInput", {
  fields: (t) => ({
    id: t.id({ required: true }),
    userId: t.id({ required: true }),
    openingCash: t.string({ required: true }),
    openedAtClient: t.field({ type: "DateTime", required: true }),
    closedAtClient: t.field({ type: "DateTime" }),
    expectedCash: t.string(),
    actualCash: t.string(),
  }),
});

const SyncOrderItemInputRef = builder.inputType("SyncOrderItemInput", {
  fields: (t) => ({
    productId: t.id({ required: true }),
    productUnitId: t.id({ required: true }),
    qty: t.string({ required: true }),
    unitPrice: t.string({ required: true }),
  }),
});

const SyncOrderInputRef = builder.inputType("SyncOrderInput", {
  fields: (t) => ({
    clientOrderId: t.id({ required: true }),
    clientSeq: t.string({ required: true }),
    clientCreatedAt: t.field({ type: "DateTime", required: true }),
    shiftId: t.id({ required: true }),
    customerId: t.id(),
    items: t.field({ type: [SyncOrderItemInputRef], required: true }),
    payments: t.field({ type: [SalePaymentInputRef], required: true }),
    signature: t.string({ required: true }),
  }),
});

const SyncOfflineBatchInputRef = builder.inputType("SyncOfflineBatchInput", {
  fields: (t) => ({
    clientBatchId: t.id({ required: true }),
    batchHash: t.string({ required: true }),
    shifts: t.field({ type: [SyncShiftInputRef], required: true }),
    orders: t.field({ type: [SyncOrderInputRef], required: true }),
  }),
});

SyncItemResultRef.implement({
  fields: (t) => ({
    clientId: t.exposeID("clientId", { nullable: false }),
    status: t.field({
      type: SyncItemStatusEnum,
      nullable: false,
      resolve: (item) => item.status,
    }),
    serverId: t.exposeID("serverId"),
    code: t.exposeString("code"),
    message: t.exposeString("message"),
  }),
});

SyncOfflineBatchPayloadRef.implement({
  fields: (t) => ({
    batchId: t.exposeID("batchId", { nullable: false }),
    shifts: t.field({
      type: [SyncItemResultRef],
      nullable: false,
      resolve: (payload) => payload.shifts,
    }),
    orders: t.field({
      type: [SyncItemResultRef],
      nullable: false,
      resolve: (payload) => payload.orders,
    }),
  }),
});

SyncBatchRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    deviceId: t.exposeID("deviceId", { nullable: false }),
    clientBatchId: t.exposeID("clientBatchId", { nullable: false }),
    batchHash: t.exposeString("batchHash", { nullable: false }),
    receivedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (batch) => batch.receivedAt,
    }),
    acceptedCount: t.exposeInt("acceptedCount", { nullable: false }),
    flaggedCount: t.exposeInt("flaggedCount", { nullable: false }),
    rejectedCount: t.exposeInt("rejectedCount", { nullable: false }),
  }),
});

SyncStatusRef.implement({
  fields: (t) => ({
    serverTime: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (status) => status.serverTime,
    }),
    deviceStatus: t.field({
      type: DeviceStatusEnum,
      resolve: (status) => status.deviceStatus,
    }),
    offlineExpiresAt: t.field({
      type: "DateTime",
      resolve: (status) => status.offlineExpiresAt,
    }),
    graceUntil: t.field({
      type: "DateTime",
      resolve: (status) => status.graceUntil,
    }),
    lastSyncAt: t.field({
      type: "DateTime",
      resolve: (status) => status.lastSyncAt,
    }),
    lastBatch: t.field({
      type: SyncBatchRef,
      resolve: (status) => status.lastBatch,
    }),
  }),
});

builder.queryFields((t) => ({
  syncStatus: t.field({
    type: SyncStatusRef,
    nullable: false,
    resolve: (_parent, _args, context) => getSyncStatus(context),
  }),
}));

builder.mutationFields((t) => ({
  syncOfflineBatch: t.field({
    type: SyncOfflineBatchPayloadRef,
    nullable: false,
    args: {
      input: t.arg({ type: SyncOfflineBatchInputRef, required: true }),
    },
    resolve: (_parent, { input }, context) =>
      syncOfflineBatch(context, input as never),
  }),
}));

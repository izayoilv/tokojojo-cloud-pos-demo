import type {
  OpnamePageView,
  StockBalancePageView,
  StockBalanceView,
  StockLocationSummaryView,
  StockMovementPageView,
  StockMovementView,
  StockOpnameItemView,
  StockOpnameView,
  StockPayloadView,
  StockSummaryView,
  StockTransferItemView,
  StockTransferView,
  TransferPageView,
} from "../../stock/service.ts";
import {
  adjustStock,
  approveOpname,
  cancelTransfer,
  completeTransfer,
  createOpname,
  createTransfer,
  getOpname,
  getTransfer,
  listOpnames,
  listStockBalances,
  listStockMovements,
  listTransfers,
  lowStockProducts,
  receiveStock,
  rejectOpname,
  stockSummary,
  submitOpname,
  updateOpname,
} from "../../stock/service.ts";
import { builder } from "../builder.ts";
import { ProductRef, ProductUnitRef } from "./catalog.ts";
import {
  DateRangeInputRef,
  PageInfoRef,
  PageInputRef,
  SortInputRef,
} from "./common.ts";
import {
  MovementReferenceTypeEnum,
  OpnameStatusEnum,
  StockLocationEnum,
  StockMovementTypeEnum,
  StockStatusEnum,
  TransferStatusEnum,
} from "./domain.ts";
import { PurchaseRef } from "./purchasing.ts";
import { UserRef } from "./user.ts";

export const StockBalanceRef =
  builder.objectRef<StockBalanceView>("StockBalance");
const StockMovementRef = builder.objectRef<StockMovementView>("StockMovement");
const StockLocationSummaryRef = builder.objectRef<StockLocationSummaryView>(
  "StockLocationSummary",
);
const StockSummaryRef = builder.objectRef<StockSummaryView>("StockSummary");
const StockTransferItemRef =
  builder.objectRef<StockTransferItemView>("StockTransferItem");
export const StockTransferRef =
  builder.objectRef<StockTransferView>("StockTransfer");
const StockOpnameItemRef =
  builder.objectRef<StockOpnameItemView>("StockOpnameItem");
export const StockOpnameRef = builder.objectRef<StockOpnameView>("StockOpname");
const StockPayloadRef = builder.objectRef<StockPayloadView>("StockPayload");

const StockBalancePageRef =
  builder.objectRef<StockBalancePageView>("StockBalancePage");
const StockMovementPageRef =
  builder.objectRef<StockMovementPageView>("StockMovementPage");
const TransferPageRef = builder.objectRef<TransferPageView>("TransferPage");
const OpnamePageRef = builder.objectRef<OpnamePageView>("OpnamePage");

const ReceiveStockItemInputRef = builder.inputType("ReceiveStockItemInput", {
  fields: (t) => ({
    productId: t.id({ required: true }),
    productUnitId: t.id({ required: true }),
    qty: t.string({ required: true }),
    unitCost: t.string({ required: true }),
  }),
});

const ReceiveStockInputRef = builder.inputType("ReceiveStockInput", {
  fields: (t) => ({
    supplierId: t.id({ required: true }),
    supplierInvoiceNo: t.string(),
    dueDate: t.string(),
    location: t.field({ type: StockLocationEnum }),
    notes: t.string(),
    items: t.field({ type: [ReceiveStockItemInputRef], required: true }),
  }),
});

const AdjustStockInputRef = builder.inputType("AdjustStockInput", {
  fields: (t) => ({
    location: t.field({ type: StockLocationEnum, required: true }),
    productId: t.id({ required: true }),
    physicalQty: t.string({ required: true }),
    systemQty: t.string(),
    reason: t.string({ required: true }),
  }),
});

const TransferItemInputRef = builder.inputType("TransferItemInput", {
  fields: (t) => ({
    productId: t.id({ required: true }),
    productUnitId: t.id({ required: true }),
    qty: t.string({ required: true }),
  }),
});

const CreateTransferInputRef = builder.inputType("CreateTransferInput", {
  fields: (t) => ({
    fromLocation: t.field({ type: StockLocationEnum, required: true }),
    toLocation: t.field({ type: StockLocationEnum, required: true }),
    items: t.field({ type: [TransferItemInputRef], required: true }),
  }),
});

const OpnameItemInputRef = builder.inputType("OpnameItemInput", {
  fields: (t) => ({
    productId: t.id({ required: true }),
    physicalQty: t.string({ required: true }),
  }),
});

const CreateOpnameInputRef = builder.inputType("CreateOpnameInput", {
  fields: (t) => ({
    location: t.field({ type: StockLocationEnum, required: true }),
    items: t.field({ type: [OpnameItemInputRef], required: true }),
  }),
});

const UpdateOpnameInputRef = builder.inputType("UpdateOpnameInput", {
  fields: (t) => ({
    items: t.field({ type: [OpnameItemInputRef], required: true }),
  }),
});

const StockBalanceFilterRef = builder.inputType("StockBalanceFilter", {
  fields: (t) => ({
    productId: t.id(),
    search: t.string(),
    location: t.field({ type: StockLocationEnum }),
    status: t.field({ type: StockStatusEnum }),
    belowMinimum: t.boolean(),
  }),
});

const StockMovementFilterRef = builder.inputType("StockMovementFilter", {
  fields: (t) => ({
    productId: t.id(),
    location: t.field({ type: StockLocationEnum }),
    movementType: t.field({ type: StockMovementTypeEnum }),
    referenceType: t.field({ type: MovementReferenceTypeEnum }),
    flagged: t.boolean(),
    range: t.field({ type: DateRangeInputRef }),
  }),
});

const TransferFilterRef = builder.inputType("TransferFilter", {
  fields: (t) => ({
    search: t.string(),
    status: t.field({ type: TransferStatusEnum }),
    location: t.field({ type: StockLocationEnum }),
    range: t.field({ type: DateRangeInputRef }),
  }),
});

const OpnameFilterRef = builder.inputType("OpnameFilter", {
  fields: (t) => ({
    search: t.string(),
    status: t.field({ type: OpnameStatusEnum }),
    location: t.field({ type: StockLocationEnum }),
    range: t.field({ type: DateRangeInputRef }),
  }),
});

StockBalanceRef.implement({
  fields: (t) => ({
    productId: t.exposeID("productId", { nullable: false }),
    product: t.field({
      type: ProductRef,
      nullable: false,
      resolve: (balance) => balance.product,
    }),
    location: t.field({
      type: StockLocationEnum,
      nullable: false,
      resolve: (balance) => balance.location,
    }),
    qty: t.exposeString("qty", { nullable: false }),
    minQty: t.exposeString("minQty"),
    status: t.field({
      type: StockStatusEnum,
      nullable: false,
      resolve: (balance) => balance.status,
    }),
    isNegative: t.exposeBoolean("isNegative", { nullable: false }),
  }),
});

StockMovementRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    productId: t.exposeID("productId", { nullable: false }),
    product: t.field({
      type: ProductRef,
      nullable: false,
      resolve: (movement) => movement.product,
    }),
    location: t.field({
      type: StockLocationEnum,
      nullable: false,
      resolve: (movement) => movement.location,
    }),
    qtyChange: t.exposeString("qtyChange", { nullable: false }),
    movementType: t.field({
      type: StockMovementTypeEnum,
      nullable: false,
      resolve: (movement) => movement.movementType,
    }),
    referenceType: t.field({
      type: MovementReferenceTypeEnum,
      nullable: false,
      resolve: (movement) => movement.referenceType,
    }),
    referenceId: t.exposeID("referenceId"),
    notes: t.exposeString("notes"),
    flagged: t.exposeBoolean("flagged", { nullable: false }),
    flagReason: t.exposeString("flagReason"),
    createdBy: t.field({
      type: UserRef,
      nullable: false,
      resolve: (movement) => movement.createdBy,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (movement) => movement.createdAt,
    }),
  }),
});

StockLocationSummaryRef.implement({
  fields: (t) => ({
    location: t.field({
      type: StockLocationEnum,
      nullable: false,
      resolve: (summary) => summary.location,
    }),
    totalQty: t.exposeString("totalQty", { nullable: false }),
    value: t.exposeString("value", { nullable: false }),
  }),
});

StockSummaryRef.implement({
  fields: (t) => ({
    asOf: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (summary) => summary.asOf,
    }),
    okCount: t.exposeInt("okCount", { nullable: false }),
    lowCount: t.exposeInt("lowCount", { nullable: false }),
    outCount: t.exposeInt("outCount", { nullable: false }),
    negativeCount: t.exposeInt("negativeCount", { nullable: false }),
    totalValue: t.exposeString("totalValue", { nullable: false }),
    byLocation: t.field({
      type: [StockLocationSummaryRef],
      nullable: false,
      resolve: (summary) => summary.byLocation,
    }),
  }),
});

StockTransferItemRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    productId: t.exposeID("productId", { nullable: false }),
    productUnitId: t.exposeID("productUnitId", { nullable: false }),
    product: t.field({
      type: ProductRef,
      nullable: false,
      resolve: (item) => item.product,
    }),
    unit: t.field({
      type: ProductUnitRef,
      nullable: false,
      resolve: (item) => item.unit,
    }),
    qty: t.exposeString("qty", { nullable: false }),
    qtyBase: t.exposeString("qtyBase", { nullable: false }),
  }),
});

StockTransferRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    transferNo: t.exposeString("transferNo", { nullable: false }),
    fromLocation: t.field({
      type: StockLocationEnum,
      nullable: false,
      resolve: (transfer) => transfer.fromLocation,
    }),
    toLocation: t.field({
      type: StockLocationEnum,
      nullable: false,
      resolve: (transfer) => transfer.toLocation,
    }),
    status: t.field({
      type: TransferStatusEnum,
      nullable: false,
      resolve: (transfer) => transfer.status,
    }),
    createdBy: t.field({
      type: UserRef,
      nullable: false,
      resolve: (transfer) => transfer.createdBy,
    }),
    reviewedBy: t.field({
      type: UserRef,
      resolve: (transfer) => transfer.reviewedBy,
    }),
    reviewedAt: t.field({
      type: "DateTime",
      resolve: (transfer) => transfer.reviewedAt,
    }),
    completedAt: t.field({
      type: "DateTime",
      resolve: (transfer) => transfer.completedAt,
    }),
    cancelledBy: t.field({
      type: UserRef,
      resolve: (transfer) => transfer.cancelledBy,
    }),
    cancelledAt: t.field({
      type: "DateTime",
      resolve: (transfer) => transfer.cancelledAt,
    }),
    items: t.field({
      type: [StockTransferItemRef],
      nullable: false,
      resolve: (transfer) => transfer.items,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (transfer) => transfer.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (transfer) => transfer.updatedAt,
    }),
  }),
});

StockOpnameItemRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    productId: t.exposeID("productId", { nullable: false }),
    product: t.field({
      type: ProductRef,
      nullable: false,
      resolve: (item) => item.product,
    }),
    systemQty: t.exposeString("systemQty", { nullable: false }),
    physicalQty: t.exposeString("physicalQty", { nullable: false }),
    diffQty: t.exposeString("diffQty", { nullable: false }),
  }),
});

StockOpnameRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    opnameNo: t.exposeString("opnameNo", { nullable: false }),
    location: t.field({
      type: StockLocationEnum,
      nullable: false,
      resolve: (opname) => opname.location,
    }),
    status: t.field({
      type: OpnameStatusEnum,
      nullable: false,
      resolve: (opname) => opname.status,
    }),
    createdBy: t.field({
      type: UserRef,
      nullable: false,
      resolve: (opname) => opname.createdBy,
    }),
    reviewedBy: t.field({
      type: UserRef,
      resolve: (opname) => opname.reviewedBy,
    }),
    reviewedAt: t.field({
      type: "DateTime",
      resolve: (opname) => opname.reviewedAt,
    }),
    submittedAt: t.field({
      type: "DateTime",
      resolve: (opname) => opname.submittedAt,
    }),
    items: t.field({
      type: [StockOpnameItemRef],
      nullable: false,
      resolve: (opname) => opname.items,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (opname) => opname.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (opname) => opname.updatedAt,
    }),
  }),
});

StockPayloadRef.implement({
  fields: (t) => ({
    purchase: t.field({
      type: PurchaseRef,
      resolve: (payload) => payload.purchase,
    }),
    opname: t.field({
      type: StockOpnameRef,
      resolve: (payload) => payload.opname,
    }),
    movements: t.field({
      type: [StockMovementRef],
      nullable: false,
      resolve: (payload) => payload.movements,
    }),
  }),
});

StockBalancePageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [StockBalanceRef],
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

StockMovementPageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [StockMovementRef],
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

TransferPageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [StockTransferRef],
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

OpnamePageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [StockOpnameRef],
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
  stockBalances: t.field({
    type: StockBalancePageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: StockBalanceFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listStockBalances(args as never),
  }),
  stockMovements: t.field({
    type: StockMovementPageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: StockMovementFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listStockMovements(args as never),
  }),
  lowStockProducts: t.field({
    type: [StockBalanceRef],
    nullable: false,
    args: { location: t.arg({ type: StockLocationEnum }) },
    resolve: (_parent, { location }) => lowStockProducts(location ?? null),
  }),
  stockSummary: t.field({
    type: StockSummaryRef,
    nullable: false,
    args: { location: t.arg({ type: StockLocationEnum }) },
    resolve: (_parent, { location }) => stockSummary(location ?? null),
  }),
  transfers: t.field({
    type: TransferPageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: TransferFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listTransfers(args as never),
  }),
  transfer: t.field({
    type: StockTransferRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }) => getTransfer(String(id)),
  }),
  opnames: t.field({
    type: OpnamePageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: OpnameFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listOpnames(args as never),
  }),
  opname: t.field({
    type: StockOpnameRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }) => getOpname(String(id)),
  }),
}));

builder.mutationFields((t) => ({
  receiveStock: t.field({
    type: StockPayloadRef,
    nullable: false,
    args: { input: t.arg({ type: ReceiveStockInputRef, required: true }) },
    resolve: (_parent, { input }, context) => receiveStock(context, input),
  }),
  adjustStock: t.field({
    type: StockPayloadRef,
    nullable: false,
    args: { input: t.arg({ type: AdjustStockInputRef, required: true }) },
    resolve: (_parent, { input }, context) => adjustStock(context, input),
  }),
  createTransfer: t.field({
    type: StockTransferRef,
    nullable: false,
    args: { input: t.arg({ type: CreateTransferInputRef, required: true }) },
    resolve: (_parent, { input }, context) => createTransfer(context, input),
  }),
  completeTransfer: t.field({
    type: StockTransferRef,
    nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }, context) =>
      completeTransfer(context, String(id)),
  }),
  cancelTransfer: t.field({
    type: StockTransferRef,
    nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }, context) => cancelTransfer(context, String(id)),
  }),
  createOpname: t.field({
    type: StockOpnameRef,
    nullable: false,
    args: { input: t.arg({ type: CreateOpnameInputRef, required: true }) },
    resolve: (_parent, { input }, context) => createOpname(context, input),
  }),
  updateOpname: t.field({
    type: StockOpnameRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateOpnameInputRef, required: true }),
    },
    resolve: (_parent, { id, input }, context) =>
      updateOpname(context, String(id), input),
  }),
  submitOpname: t.field({
    type: StockOpnameRef,
    nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }, context) => submitOpname(context, String(id)),
  }),
  approveOpname: t.field({
    type: StockOpnameRef,
    nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }, context) => approveOpname(context, String(id)),
  }),
  rejectOpname: t.field({
    type: StockOpnameRef,
    nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }, context) => rejectOpname(context, String(id)),
  }),
}));

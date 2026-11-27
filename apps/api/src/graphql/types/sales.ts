import type { CashFlowPageView, CashFlowView } from "../../finance/service.ts";
import { createManualCashFlow, listCashFlows } from "../../finance/service.ts";
import type {
  ReceivablePageView,
  ReceivableView,
  SaleItemView,
  SalePageView,
  SalePayloadView,
  SalePaymentView,
  SaleReturnItemView,
  SaleReturnView,
  SaleView,
  ShiftPageView,
  ShiftView,
} from "../../sales/service.ts";
import {
  closeShift,
  createSale,
  createSaleReturn,
  currentShift,
  getSale,
  getShift,
  listReceivables,
  listSales,
  listShifts,
  openShift,
  voidSale,
} from "../../sales/service.ts";
import { builder } from "../builder.ts";
import { DeviceRef } from "./auth.ts";
import { CustomerRef, ProductRef, ProductUnitRef } from "./catalog.ts";
import {
  DateRangeInputRef,
  PageInfoRef,
  PageInputRef,
  SortInputRef,
} from "./common.ts";
import {
  CashFlowCategoryEnum,
  CashFlowReferenceTypeEnum,
  CashFlowSourceEnum,
  CashFlowTypeEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
  SaleSettlementEnum,
  SaleSourceEnum,
  SaleStatusEnum,
  ShiftSourceEnum,
  ShiftStatusEnum,
} from "./domain.ts";
import { UserRef } from "./user.ts";

export const CashierShiftRef = builder.objectRef<ShiftView>("CashierShift");
export const SaleItemRef = builder.objectRef<SaleItemView>("SaleItem");
export const SalePaymentRef = builder.objectRef<SalePaymentView>("SalePayment");
export const SaleReturnItemRef =
  builder.objectRef<SaleReturnItemView>("SaleReturnItem");
export const SaleReturnRef = builder.objectRef<SaleReturnView>("SaleReturn");
export const SaleRef = builder.objectRef<SaleView>("Sale");
const SalePayloadRef = builder.objectRef<SalePayloadView>("SalePayload");
const ReceivableRef = builder.objectRef<ReceivableView>("Receivable");
const CashFlowRef = builder.objectRef<CashFlowView>("CashFlow");

const ShiftPageRef = builder.objectRef<ShiftPageView>("ShiftPage");
const SalePageRef = builder.objectRef<SalePageView>("SalePage");
const ReceivablePageRef =
  builder.objectRef<ReceivablePageView>("ReceivablePage");
const CashFlowPageRef = builder.objectRef<CashFlowPageView>("CashFlowPage");

const OpenShiftInputRef = builder.inputType("OpenShiftInput", {
  fields: (t) => ({
    id: t.id(),
    userId: t.id(),
    openingCash: t.string({ required: true }),
    openedAtClient: t.field({ type: "DateTime" }),
  }),
});

const CloseShiftInputRef = builder.inputType("CloseShiftInput", {
  fields: (t) => ({
    shiftId: t.id({ required: true }),
    actualCash: t.string({ required: true }),
    closedAtClient: t.field({ type: "DateTime" }),
  }),
});

const CreateSaleItemInputRef = builder.inputType("CreateSaleItemInput", {
  fields: (t) => ({
    productId: t.id({ required: true }),
    productUnitId: t.id({ required: true }),
    qty: t.string({ required: true }),
    unitPrice: t.string({ required: true }),
    discount: t.string(),
  }),
});

export const SalePaymentInputRef = builder.inputType("SalePaymentInput", {
  fields: (t) => ({
    method: t.field({ type: PaymentMethodEnum, required: true }),
    amount: t.string({ required: true }),
    cashReceived: t.string(),
    paymentRef: t.string(),
  }),
});

const CreateSaleInputRef = builder.inputType("CreateSaleInput", {
  fields: (t) => ({
    shiftId: t.id({ required: true }),
    customerId: t.id(),
    items: t.field({ type: [CreateSaleItemInputRef], required: true }),
    payments: t.field({ type: [SalePaymentInputRef], required: true }),
    clientOrderId: t.id(),
    clientSeq: t.string(),
    clientCreatedAt: t.field({ type: "DateTime" }),
    signature: t.string(),
  }),
});

const CreateSaleReturnItemInputRef = builder.inputType(
  "CreateSaleReturnItemInput",
  {
    fields: (t) => ({
      saleItemId: t.id({ required: true }),
      qty: t.string({ required: true }),
    }),
  },
);

const CreateSaleReturnInputRef = builder.inputType("CreateSaleReturnInput", {
  fields: (t) => ({
    saleId: t.id({ required: true }),
    reason: t.string({ required: true }),
    items: t.field({ type: [CreateSaleReturnItemInputRef], required: true }),
    refundMethod: t.field({ type: PaymentMethodEnum }),
  }),
});

const CreateCashFlowInputRef = builder.inputType("CreateCashFlowInput", {
  fields: (t) => ({
    type: t.field({ type: CashFlowTypeEnum, required: true }),
    paymentMethod: t.field({ type: PaymentMethodEnum, required: true }),
    category: t.field({ type: CashFlowCategoryEnum, required: true }),
    amount: t.string({ required: true }),
    notes: t.string(),
  }),
});

const SaleFilterRef = builder.inputType("SaleFilter", {
  fields: (t) => ({
    search: t.string(),
    customerId: t.id(),
    userId: t.id(),
    shiftId: t.id(),
    settlementMethod: t.field({ type: SaleSettlementEnum }),
    status: t.field({ type: SaleStatusEnum }),
    paymentStatus: t.field({ type: PaymentStatusEnum }),
    source: t.field({ type: SaleSourceEnum }),
    deviceId: t.id(),
    range: t.field({ type: DateRangeInputRef }),
  }),
});

const ReceivableFilterRef = builder.inputType("ReceivableFilter", {
  fields: (t) => ({
    search: t.string(),
    customerId: t.id(),
    paymentStatus: t.field({ type: PaymentStatusEnum }),
  }),
});

const ShiftFilterRef = builder.inputType("ShiftFilter", {
  fields: (t) => ({
    userId: t.id(),
    status: t.field({ type: ShiftStatusEnum }),
    source: t.field({ type: ShiftSourceEnum }),
    deviceId: t.id(),
    range: t.field({ type: DateRangeInputRef }),
  }),
});

const CashFlowFilterRef = builder.inputType("CashFlowFilter", {
  fields: (t) => ({
    type: t.field({ type: CashFlowTypeEnum }),
    category: t.field({ type: CashFlowCategoryEnum }),
    paymentMethod: t.field({ type: PaymentMethodEnum }),
    source: t.field({ type: CashFlowSourceEnum }),
    range: t.field({ type: DateRangeInputRef }),
  }),
});

CashierShiftRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    userId: t.exposeID("userId", { nullable: false }),
    user: t.field({
      type: UserRef,
      nullable: false,
      resolve: (shift) => shift.user,
    }),
    status: t.field({
      type: ShiftStatusEnum,
      nullable: false,
      resolve: (shift) => shift.status,
    }),
    openedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (shift) => shift.openedAt,
    }),
    closedAt: t.field({
      type: "DateTime",
      resolve: (shift) => shift.closedAt,
    }),
    openingCash: t.exposeString("openingCash", { nullable: false }),
    expectedCash: t.exposeString("expectedCash"),
    actualCash: t.exposeString("actualCash"),
    deviceId: t.exposeID("deviceId"),
    device: t.field({
      type: DeviceRef,
      resolve: (shift) => shift.device,
    }),
    source: t.field({
      type: ShiftSourceEnum,
      nullable: false,
      resolve: (shift) => shift.source,
    }),
    openedAtClient: t.field({
      type: "DateTime",
      resolve: (shift) => shift.openedAtClient,
    }),
    closedAtClient: t.field({
      type: "DateTime",
      resolve: (shift) => shift.closedAtClient,
    }),
    receivedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (shift) => shift.receivedAt,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (shift) => shift.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (shift) => shift.updatedAt,
    }),
  }),
});

SaleItemRef.implement({
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
    productName: t.exposeString("productName", { nullable: false }),
    unitName: t.exposeString("unitName", { nullable: false }),
    qty: t.exposeString("qty", { nullable: false }),
    qtyBase: t.exposeString("qtyBase", { nullable: false }),
    unitPrice: t.exposeString("unitPrice", { nullable: false }),
    discount: t.exposeString("discount", { nullable: false }),
    unitCost: t.exposeString("unitCost", { nullable: false }),
    subtotal: t.exposeString("subtotal", { nullable: false }),
  }),
});

SalePaymentRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    method: t.field({
      type: PaymentMethodEnum,
      nullable: false,
      resolve: (payment) => payment.method,
    }),
    amount: t.exposeString("amount", { nullable: false }),
    cashReceived: t.exposeString("cashReceived", { nullable: false }),
    change: t.exposeString("change", { nullable: false }),
    paymentRef: t.exposeString("paymentRef"),
    receivedBy: t.field({
      type: UserRef,
      nullable: false,
      resolve: (payment) => payment.receivedBy,
    }),
    shiftId: t.exposeID("shiftId"),
    paidAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (payment) => payment.paidAt,
    }),
  }),
});

SaleReturnItemRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    saleItemId: t.exposeID("saleItemId", { nullable: false }),
    saleItem: t.field({
      type: SaleItemRef,
      nullable: false,
      resolve: (item) => item.saleItem,
    }),
    qty: t.exposeString("qty", { nullable: false }),
    qtyBase: t.exposeString("qtyBase", { nullable: false }),
    refundAmount: t.exposeString("refundAmount", { nullable: false }),
  }),
});

SaleReturnRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    returnNo: t.exposeString("returnNo", { nullable: false }),
    saleId: t.exposeID("saleId", { nullable: false }),
    createdBy: t.field({
      type: UserRef,
      nullable: false,
      resolve: (saleReturn) => saleReturn.createdBy,
    }),
    reason: t.exposeString("reason", { nullable: false }),
    totalRefund: t.exposeString("totalRefund", { nullable: false }),
    cashRefund: t.exposeString("cashRefund", { nullable: false }),
    refundMethod: t.field({
      type: PaymentMethodEnum,
      resolve: (saleReturn) => saleReturn.refundMethod,
    }),
    refundedAt: t.field({
      type: "DateTime",
      resolve: (saleReturn) => saleReturn.refundedAt,
    }),
    shiftId: t.exposeID("shiftId"),
    items: t.field({
      type: [SaleReturnItemRef],
      nullable: false,
      resolve: (saleReturn) => saleReturn.items,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (saleReturn) => saleReturn.createdAt,
    }),
  }),
});

SaleRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    invoiceNo: t.exposeString("invoiceNo", { nullable: false }),
    shiftId: t.exposeID("shiftId", { nullable: false }),
    shift: t.field({
      type: CashierShiftRef,
      nullable: false,
      resolve: (sale) => sale.shift,
    }),
    user: t.field({
      type: UserRef,
      nullable: false,
      resolve: (sale) => sale.user,
    }),
    customer: t.field({
      type: CustomerRef,
      resolve: (sale) => sale.customer,
    }),
    items: t.field({
      type: [SaleItemRef],
      nullable: false,
      resolve: (sale) => sale.items,
    }),
    payments: t.field({
      type: [SalePaymentRef],
      nullable: false,
      resolve: (sale) => sale.payments,
    }),
    returns: t.field({
      type: [SaleReturnRef],
      nullable: false,
      resolve: (sale) => sale.returns,
    }),
    subtotal: t.exposeString("subtotal", { nullable: false }),
    discount: t.exposeString("discount", { nullable: false }),
    totalAmount: t.exposeString("totalAmount", { nullable: false }),
    paid: t.exposeString("paid"),
    outstanding: t.exposeString("outstanding"),
    paymentStatus: t.field({
      type: PaymentStatusEnum,
      resolve: (sale) => sale.paymentStatus,
    }),
    settlementMethod: t.field({
      type: SaleSettlementEnum,
      nullable: false,
      resolve: (sale) => sale.settlementMethod,
    }),
    status: t.field({
      type: SaleStatusEnum,
      nullable: false,
      resolve: (sale) => sale.status,
    }),
    voidedAt: t.field({
      type: "DateTime",
      resolve: (sale) => sale.voidedAt,
    }),
    voidedBy: t.field({
      type: UserRef,
      resolve: (sale) => sale.voidedBy,
    }),
    voidReason: t.exposeString("voidReason"),
    source: t.field({
      type: SaleSourceEnum,
      nullable: false,
      resolve: (sale) => sale.source,
    }),
    deviceId: t.exposeID("deviceId"),
    device: t.field({
      type: DeviceRef,
      resolve: (sale) => sale.device,
    }),
    clientOrderId: t.exposeID("clientOrderId"),
    clientSeq: t.exposeString("clientSeq"),
    clientCreatedAt: t.field({
      type: "DateTime",
      resolve: (sale) => sale.clientCreatedAt,
    }),
    receivedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (sale) => sale.receivedAt,
    }),
    signatureVerified: t.exposeBoolean("signatureVerified", {
      nullable: false,
    }),
    priceVariance: t.exposeString("priceVariance", { nullable: false }),
    syncBatchId: t.exposeID("syncBatchId"),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (sale) => sale.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (sale) => sale.updatedAt,
    }),
  }),
});

SalePayloadRef.implement({
  fields: (t) => ({
    sale: t.field({
      type: SaleRef,
      nullable: false,
      resolve: (payload) => payload.sale,
    }),
    duplicate: t.exposeBoolean("duplicate", { nullable: false }),
  }),
});

ReceivableRef.implement({
  fields: (t) => ({
    sale: t.field({
      type: SaleRef,
      nullable: false,
      resolve: (receivable) => receivable.sale,
    }),
    invoiceNo: t.exposeString("invoiceNo", { nullable: false }),
    customer: t.field({
      type: CustomerRef,
      nullable: false,
      resolve: (receivable) => receivable.customer,
    }),
    totalAmount: t.exposeString("totalAmount", { nullable: false }),
    paid: t.exposeString("paid", { nullable: false }),
    outstanding: t.exposeString("outstanding", { nullable: false }),
    paymentStatus: t.field({
      type: PaymentStatusEnum,
      nullable: false,
      resolve: (receivable) => receivable.paymentStatus,
    }),
  }),
});

CashFlowRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    type: t.field({
      type: CashFlowTypeEnum,
      nullable: false,
      resolve: (flow) => flow.type,
    }),
    paymentMethod: t.field({
      type: PaymentMethodEnum,
      nullable: false,
      resolve: (flow) => flow.paymentMethod,
    }),
    category: t.field({
      type: CashFlowCategoryEnum,
      nullable: false,
      resolve: (flow) => flow.category,
    }),
    amount: t.exposeString("amount", { nullable: false }),
    shiftId: t.exposeID("shiftId"),
    referenceType: t.field({
      type: CashFlowReferenceTypeEnum,
      nullable: false,
      resolve: (flow) => flow.referenceType,
    }),
    referenceId: t.exposeID("referenceId"),
    source: t.field({
      type: CashFlowSourceEnum,
      nullable: false,
      resolve: (flow) => flow.source,
    }),
    notes: t.exposeString("notes"),
    createdBy: t.field({
      type: UserRef,
      nullable: false,
      resolve: (flow) => flow.createdBy,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (flow) => flow.createdAt,
    }),
  }),
});

ShiftPageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [CashierShiftRef],
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

SalePageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [SaleRef],
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

ReceivablePageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [ReceivableRef],
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

CashFlowPageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [CashFlowRef],
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
  sales: t.field({
    type: SalePageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: SaleFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listSales(args as never),
  }),
  sale: t.field({
    type: SaleRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }) => getSale(String(id)),
  }),
  receivables: t.field({
    type: ReceivablePageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: ReceivableFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listReceivables(args as never),
  }),
  shifts: t.field({
    type: ShiftPageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: ShiftFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listShifts(args as never),
  }),
  shift: t.field({
    type: CashierShiftRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }) => getShift(String(id)),
  }),
  currentShift: t.field({
    type: CashierShiftRef,
    args: { userId: t.arg.id() },
    resolve: (_parent, { userId }, context) =>
      currentShift(context, userId ? String(userId) : null),
  }),
  cashFlows: t.field({
    type: CashFlowPageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: CashFlowFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listCashFlows(args as never),
  }),
}));

builder.mutationFields((t) => ({
  createSale: t.field({
    type: SalePayloadRef,
    nullable: false,
    args: { input: t.arg({ type: CreateSaleInputRef, required: true }) },
    resolve: (_parent, { input }, context) =>
      createSale(context, input as never),
  }),
  createSaleReturn: t.field({
    type: SaleReturnRef,
    nullable: false,
    args: {
      input: t.arg({ type: CreateSaleReturnInputRef, required: true }),
    },
    resolve: (_parent, { input }, context) =>
      createSaleReturn(context, input as never),
  }),
  voidSale: t.field({
    type: SaleRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      reason: t.arg.string({ required: true }),
    },
    resolve: (_parent, { id, reason }, context) =>
      voidSale(context, String(id), reason),
  }),
  openShift: t.field({
    type: CashierShiftRef,
    nullable: false,
    args: { input: t.arg({ type: OpenShiftInputRef, required: true }) },
    resolve: (_parent, { input }, context) =>
      openShift(context, input as never),
  }),
  closeShift: t.field({
    type: CashierShiftRef,
    nullable: false,
    args: { input: t.arg({ type: CloseShiftInputRef, required: true }) },
    resolve: (_parent, { input }, context) =>
      closeShift(context, input as never),
  }),
  createCashFlow: t.field({
    type: CashFlowRef,
    nullable: false,
    args: { input: t.arg({ type: CreateCashFlowInputRef, required: true }) },
    resolve: (_parent, { input }, context) =>
      createManualCashFlow(context, input),
  }),
}));

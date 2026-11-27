import type {
  PayablePageView,
  PayableView,
  PurchaseItemView,
  PurchasePageView,
  PurchasePaymentView,
  PurchaseView,
} from "../../purchasing/service.ts";
import {
  addPurchasePayment,
  cancelPurchase,
  createPurchase,
  getPurchase,
  listPayables,
  listPurchases,
} from "../../purchasing/service.ts";
import { builder } from "../builder.ts";
import { ProductRef, ProductUnitRef, SupplierRef } from "./catalog.ts";
import {
  DateRangeInputRef,
  PageInfoRef,
  PageInputRef,
  SortInputRef,
} from "./common.ts";
import {
  PaymentMethodEnum,
  PaymentStatusEnum,
  PurchaseStatusEnum,
} from "./domain.ts";
import { UserRef } from "./user.ts";

export const PurchaseItemRef =
  builder.objectRef<PurchaseItemView>("PurchaseItem");
export const PurchasePaymentRef =
  builder.objectRef<PurchasePaymentView>("PurchasePayment");
export const PurchaseRef = builder.objectRef<PurchaseView>("Purchase");
export const PayableRef = builder.objectRef<PayableView>("Payable");

const PurchasePageRef = builder.objectRef<PurchasePageView>("PurchasePage");
const PayablePageRef = builder.objectRef<PayablePageView>("PayablePage");

const PurchaseItemInputRef = builder.inputType("PurchaseItemInput", {
  fields: (t) => ({
    productId: t.id({ required: true }),
    productUnitId: t.id({ required: true }),
    qty: t.string({ required: true }),
    unitCost: t.string({ required: true }),
  }),
});

const CreatePurchaseInputRef = builder.inputType("CreatePurchaseInput", {
  fields: (t) => ({
    supplierId: t.id({ required: true }),
    supplierInvoiceNo: t.string(),
    dueDate: t.string(),
    items: t.field({ type: [PurchaseItemInputRef], required: true }),
  }),
});

const AddPurchasePaymentInputRef = builder.inputType(
  "AddPurchasePaymentInput",
  {
    fields: (t) => ({
      purchaseId: t.id({ required: true }),
      amount: t.string({ required: true }),
      paymentMethod: t.field({ type: PaymentMethodEnum, required: true }),
      reference: t.string(),
      paidAt: t.field({ type: "DateTime" }),
    }),
  },
);

const PurchaseFilterRef = builder.inputType("PurchaseFilter", {
  fields: (t) => ({
    search: t.string(),
    supplierId: t.id(),
    status: t.field({ type: PurchaseStatusEnum }),
    paymentStatus: t.field({ type: PaymentStatusEnum }),
    range: t.field({ type: DateRangeInputRef }),
  }),
});

const PayableFilterRef = builder.inputType("PayableFilter", {
  fields: (t) => ({
    search: t.string(),
    supplierId: t.id(),
    paymentStatus: t.field({ type: PaymentStatusEnum }),
    dueBefore: t.string(),
  }),
});

PurchaseItemRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    productId: t.exposeID("productId", { nullable: false }),
    productUnitId: t.exposeID("productUnitId", { nullable: false }),
    product: t.field({
      type: ProductRef,
      nullable: false,
      resolve: (item) => item.product!,
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
    unitCost: t.exposeString("unitCost", { nullable: false }),
    subtotal: t.exposeString("subtotal", { nullable: false }),
  }),
});

PurchasePaymentRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    amount: t.exposeString("amount", { nullable: false }),
    paymentMethod: t.field({
      type: PaymentMethodEnum,
      nullable: false,
      resolve: (payment) => payment.paymentMethod,
    }),
    reference: t.exposeString("reference"),
    paidAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (payment) => payment.paidAt,
    }),
    createdBy: t.field({
      type: UserRef,
      nullable: false,
      resolve: (payment) => payment.createdBy,
    }),
  }),
});

PurchaseRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    purchaseNo: t.exposeString("purchaseNo", { nullable: false }),
    supplierId: t.exposeID("supplierId", { nullable: false }),
    supplier: t.field({
      type: SupplierRef,
      nullable: false,
      resolve: (purchase) => purchase.supplier!,
    }),
    supplierName: t.exposeString("supplierName", { nullable: false }),
    createdBy: t.field({
      type: UserRef,
      nullable: false,
      resolve: (purchase) => purchase.createdBy,
    }),
    supplierInvoiceNo: t.exposeString("supplierInvoiceNo"),
    dueDate: t.exposeString("dueDate"),
    totalAmount: t.exposeString("totalAmount", { nullable: false }),
    paid: t.exposeString("paid", { nullable: false }),
    outstanding: t.exposeString("outstanding", { nullable: false }),
    paymentStatus: t.field({
      type: PaymentStatusEnum,
      nullable: false,
      resolve: (purchase) => purchase.paymentStatus,
    }),
    receivedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (purchase) => purchase.receivedAt,
    }),
    status: t.field({
      type: PurchaseStatusEnum,
      nullable: false,
      resolve: (purchase) => purchase.status,
    }),
    items: t.field({
      type: [PurchaseItemRef],
      nullable: false,
      resolve: (purchase) => purchase.items,
    }),
    payments: t.field({
      type: [PurchasePaymentRef],
      nullable: false,
      resolve: (purchase) => purchase.payments,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (purchase) => purchase.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (purchase) => purchase.updatedAt,
    }),
  }),
});

PayableRef.implement({
  fields: (t) => ({
    purchase: t.field({
      type: PurchaseRef,
      nullable: false,
      resolve: (payable) => payable.purchase,
    }),
    purchaseNo: t.exposeString("purchaseNo", { nullable: false }),
    supplier: t.field({
      type: SupplierRef,
      nullable: false,
      resolve: (payable) => payable.supplier,
    }),
    supplierInvoiceNo: t.exposeString("supplierInvoiceNo"),
    dueDate: t.exposeString("dueDate"),
    totalAmount: t.exposeString("totalAmount", { nullable: false }),
    paid: t.exposeString("paid", { nullable: false }),
    outstanding: t.exposeString("outstanding", { nullable: false }),
    paymentStatus: t.field({
      type: PaymentStatusEnum,
      nullable: false,
      resolve: (payable) => payable.paymentStatus,
    }),
  }),
});

PurchasePageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [PurchaseRef],
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

PayablePageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [PayableRef],
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
  purchases: t.field({
    type: PurchasePageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: PurchaseFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listPurchases(args as never),
  }),
  purchase: t.field({
    type: PurchaseRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }) => getPurchase(String(id)),
  }),
  payables: t.field({
    type: PayablePageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: PayableFilterRef }),
      page: t.arg({ type: PageInputRef }),
      sort: t.arg({ type: SortInputRef }),
    },
    resolve: (_parent, args) => listPayables(args as never),
  }),
}));

builder.mutationFields((t) => ({
  createPurchase: t.field({
    type: PurchaseRef,
    nullable: false,
    args: { input: t.arg({ type: CreatePurchaseInputRef, required: true }) },
    resolve: (_parent, { input }, context) => createPurchase(context, input),
  }),
  cancelPurchase: t.field({
    type: PurchaseRef,
    nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }, context) => cancelPurchase(context, String(id)),
  }),
  addPurchasePayment: t.field({
    type: PurchaseRef,
    nullable: false,
    args: {
      input: t.arg({ type: AddPurchasePaymentInputRef, required: true }),
    },
    resolve: (_parent, { input }, context) =>
      addPurchasePayment(context, {
        ...input,
        paidAt: input.paidAt ? new Date(input.paidAt as Date | string) : null,
      }),
  }),
}));

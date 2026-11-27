import type {
  DashboardSummaryView,
  FinanceCategoryRowView,
  FinanceReportView,
  InventoryReportRowView,
  InventoryReportView,
  SalesReportRowView,
  SalesReportView,
  SalesSeriesPointView,
  StockStatusCountsView,
} from "../../reports/service.ts";
import {
  getDashboardSummary,
  getFinanceReport,
  getInventoryReport,
  getSalesReport,
} from "../../reports/service.ts";
import { builder } from "../builder.ts";
import { ProductRef } from "./catalog.ts";
import { DateRangeInputRef } from "./common.ts";
import {
  CashFlowCategoryEnum,
  CashFlowTypeEnum,
  SalesReportGroupByEnum,
  StockLocationEnum,
  StockStatusEnum,
} from "./domain.ts";
import { PayableRef } from "./purchasing.ts";
import { SaleRef } from "./sales.ts";
import { StockBalanceRef, StockOpnameRef, StockTransferRef } from "./stock.ts";

const SalesSeriesPointRef =
  builder.objectRef<SalesSeriesPointView>("SalesSeriesPoint");
const StockStatusCountsRef =
  builder.objectRef<StockStatusCountsView>("StockStatusCounts");
const DashboardSummaryRef =
  builder.objectRef<DashboardSummaryView>("DashboardSummary");
const SalesReportRowRef =
  builder.objectRef<SalesReportRowView>("SalesReportRow");
const SalesReportRef = builder.objectRef<SalesReportView>("SalesReport");
const InventoryReportRowRef =
  builder.objectRef<InventoryReportRowView>("InventoryReportRow");
const InventoryReportRef =
  builder.objectRef<InventoryReportView>("InventoryReport");
const FinanceCategoryRowRef =
  builder.objectRef<FinanceCategoryRowView>("FinanceCategoryRow");
const FinanceReportRef = builder.objectRef<FinanceReportView>("FinanceReport");

SalesSeriesPointRef.implement({
  fields: (t) => ({
    date: t.exposeString("date", { nullable: false }),
    saleCount: t.exposeInt("saleCount", { nullable: false }),
    total: t.exposeString("total", { nullable: false }),
  }),
});

StockStatusCountsRef.implement({
  fields: (t) => ({
    ok: t.exposeInt("ok", { nullable: false }),
    low: t.exposeInt("low", { nullable: false }),
    out: t.exposeInt("out", { nullable: false }),
  }),
});

DashboardSummaryRef.implement({
  fields: (t) => ({
    asOf: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (summary) => summary.asOf,
    }),
    salesTotal: t.exposeString("salesTotal", { nullable: false }),
    cogsTotal: t.exposeString("cogsTotal", { nullable: false }),
    grossProfit: t.exposeString("grossProfit", { nullable: false }),
    marginPercent: t.exposeString("marginPercent", { nullable: false }),
    salesSeries: t.field({
      type: [SalesSeriesPointRef],
      nullable: false,
      resolve: (summary) => summary.salesSeries,
    }),
    stockStatus: t.field({
      type: StockStatusCountsRef,
      nullable: false,
      resolve: (summary) => summary.stockStatus,
    }),
    lowStock: t.field({
      type: [StockBalanceRef],
      nullable: false,
      resolve: (summary) => summary.lowStock,
    }),
    payablesDue: t.field({
      type: [PayableRef],
      nullable: false,
      resolve: (summary) => summary.payablesDue,
    }),
    recentSales: t.field({
      type: [SaleRef],
      nullable: false,
      resolve: (summary) => summary.recentSales,
    }),
    pendingTransfers: t.field({
      type: [StockTransferRef],
      nullable: false,
      resolve: (summary) => summary.pendingTransfers,
    }),
    pendingOpnames: t.field({
      type: [StockOpnameRef],
      nullable: false,
      resolve: (summary) => summary.pendingOpnames,
    }),
  }),
});

SalesReportRowRef.implement({
  fields: (t) => ({
    groupKey: t.exposeString("groupKey", { nullable: false }),
    groupLabel: t.exposeString("groupLabel", { nullable: false }),
    saleCount: t.exposeInt("saleCount", { nullable: false }),
    qtyBase: t.exposeString("qtyBase", { nullable: false }),
    sales: t.exposeString("sales", { nullable: false }),
    discount: t.exposeString("discount", { nullable: false }),
    returns: t.exposeString("returns", { nullable: false }),
    cogs: t.exposeString("cogs", { nullable: false }),
    grossProfit: t.exposeString("grossProfit", { nullable: false }),
  }),
});

SalesReportRef.implement({
  fields: (t) => ({
    generatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (report) => report.generatedAt,
    }),
    rows: t.field({
      type: [SalesReportRowRef],
      nullable: false,
      resolve: (report) => report.rows,
    }),
    saleCount: t.exposeInt("saleCount", { nullable: false }),
    salesTotal: t.exposeString("salesTotal", { nullable: false }),
    discountTotal: t.exposeString("discountTotal", { nullable: false }),
    returnsTotal: t.exposeString("returnsTotal", { nullable: false }),
    cogsTotal: t.exposeString("cogsTotal", { nullable: false }),
    grossProfitTotal: t.exposeString("grossProfitTotal", { nullable: false }),
  }),
});

InventoryReportRowRef.implement({
  fields: (t) => ({
    product: t.field({
      type: ProductRef,
      nullable: false,
      resolve: (row) => row.product,
    }),
    location: t.field({
      type: StockLocationEnum,
      nullable: false,
      resolve: (row) => row.location,
    }),
    openingQty: t.exposeString("openingQty", { nullable: false }),
    receivedQty: t.exposeString("receivedQty", { nullable: false }),
    soldQty: t.exposeString("soldQty", { nullable: false }),
    adjustedQty: t.exposeString("adjustedQty", { nullable: false }),
    closingQty: t.exposeString("closingQty", { nullable: false }),
    avgCost: t.exposeString("avgCost", { nullable: false }),
    value: t.exposeString("value", { nullable: false }),
    minQty: t.exposeString("minQty"),
    status: t.field({
      type: StockStatusEnum,
      nullable: false,
      resolve: (row) => row.status,
    }),
  }),
});

InventoryReportRef.implement({
  fields: (t) => ({
    generatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (report) => report.generatedAt,
    }),
    rows: t.field({
      type: [InventoryReportRowRef],
      nullable: false,
      resolve: (report) => report.rows,
    }),
    totalValue: t.exposeString("totalValue", { nullable: false }),
    lowCount: t.exposeInt("lowCount", { nullable: false }),
    outCount: t.exposeInt("outCount", { nullable: false }),
  }),
});

FinanceCategoryRowRef.implement({
  fields: (t) => ({
    category: t.field({
      type: CashFlowCategoryEnum,
      nullable: false,
      resolve: (row) => row.category,
    }),
    type: t.field({
      type: CashFlowTypeEnum,
      nullable: false,
      resolve: (row) => row.type,
    }),
    amount: t.exposeString("amount", { nullable: false }),
    count: t.exposeInt("count", { nullable: false }),
  }),
});

FinanceReportRef.implement({
  fields: (t) => ({
    generatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (report) => report.generatedAt,
    }),
    cashIn: t.exposeString("cashIn", { nullable: false }),
    cashOut: t.exposeString("cashOut", { nullable: false }),
    netCash: t.exposeString("netCash", { nullable: false }),
    byCategory: t.field({
      type: [FinanceCategoryRowRef],
      nullable: false,
      resolve: (report) => report.byCategory,
    }),
    receivablesOutstanding: t.exposeString("receivablesOutstanding", {
      nullable: false,
    }),
    payablesOutstanding: t.exposeString("payablesOutstanding", {
      nullable: false,
    }),
  }),
});

builder.queryFields((t) => ({
  dashboardSummary: t.field({
    type: DashboardSummaryRef,
    nullable: false,
    args: {
      range: t.arg({ type: DateRangeInputRef }),
      location: t.arg({ type: StockLocationEnum }),
    },
    resolve: (_parent, args) => getDashboardSummary(args),
  }),
  salesReport: t.field({
    type: SalesReportRef,
    nullable: false,
    args: {
      range: t.arg({ type: DateRangeInputRef }),
      groupBy: t.arg({ type: SalesReportGroupByEnum, required: true }),
    },
    resolve: (_parent, args) =>
      getSalesReport({
        range: args.range,
        groupBy: args.groupBy,
      }),
  }),
  inventoryReport: t.field({
    type: InventoryReportRef,
    nullable: false,
    args: {
      range: t.arg({ type: DateRangeInputRef }),
      location: t.arg({ type: StockLocationEnum }),
    },
    resolve: (_parent, args) => getInventoryReport(args),
  }),
  financeReport: t.field({
    type: FinanceReportRef,
    nullable: false,
    args: {
      range: t.arg({ type: DateRangeInputRef }),
    },
    resolve: (_parent, args) => getFinanceReport(args),
  }),
}));

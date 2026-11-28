import type { Role } from "../auth/permissions.ts";
import { loadProductsByIds, type ProductView } from "../catalog/service.ts";
import {
  type DbClient,
  decimal,
  getSqlClient,
  money,
  toQuantity,
} from "../db/query.ts";
import { validationFailed } from "../graphql/errors.ts";
import { listPayables, type PayableView } from "../purchasing/service.ts";
import { listSales, type SaleView } from "../sales/service.ts";
import {
  listOpnames,
  listTransfers,
  lowStockProducts,
  type StockBalanceView,
  type StockOpnameView,
  stockSummary,
  type StockTransferView,
} from "../stock/service.ts";

export interface DateRangeView {
  from?: Date | string | null;
  to?: Date | string | null;
}

interface Bounds {
  from: Date | null;
  to: Date | null;
}

export interface SalesSeriesPointView {
  date: string;
  saleCount: number;
  total: string;
}

export interface StockStatusCountsView {
  ok: number;
  low: number;
  out: number;
}

export interface DashboardSummaryView {
  asOf: Date;
  salesTotal: string;
  cogsTotal: string;
  grossProfit: string;
  marginPercent: string;
  salesSeries: SalesSeriesPointView[];
  stockStatus: StockStatusCountsView;
  lowStock: StockBalanceView[];
  payablesDue: PayableView[];
  recentSales: SaleView[];
  pendingTransfers: StockTransferView[];
  pendingOpnames: StockOpnameView[];
}

export interface SalesReportRowView {
  groupKey: string;
  groupLabel: string;
  saleCount: number;
  qtyBase: string;
  sales: string;
  discount: string;
  returns: string;
  cogs: string;
  grossProfit: string;
}

export interface SalesReportView {
  generatedAt: Date;
  rows: SalesReportRowView[];
  saleCount: number;
  salesTotal: string;
  discountTotal: string;
  returnsTotal: string;
  cogsTotal: string;
  grossProfitTotal: string;
}

export interface InventoryReportRowView {
  product: ProductView;
  location: "WAREHOUSE" | "STORE";
  openingQty: string;
  receivedQty: string;
  soldQty: string;
  adjustedQty: string;
  closingQty: string;
  avgCost: string;
  value: string;
  minQty: string | null;
  status: "OK" | "LOW" | "OUT";
}

export interface InventoryReportView {
  generatedAt: Date;
  rows: InventoryReportRowView[];
  totalValue: string;
  lowCount: number;
  outCount: number;
}

export interface FinanceCategoryRowView {
  category:
    | "SALES"
    | "DEBT_PAYMENT"
    | "REFUND"
    | "PURCHASE"
    | "EXPENSE"
    | "CAPITAL"
    | "OTHER";
  type: "IN" | "OUT";
  amount: string;
  count: number;
}

export interface FinanceReportView {
  generatedAt: Date;
  cashIn: string;
  cashOut: string;
  netCash: string;
  byCategory: FinanceCategoryRowView[];
  receivablesOutstanding: string;
  payablesOutstanding: string;
}

function dateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function boundsFor(range: DateRangeView | null | undefined): Bounds {
  const rawFrom = range?.from ?? null;
  const rawTo = range?.to ?? null;
  let from: Date | null = null;
  let to: Date | null = null;

  if (rawFrom !== null) {
    const value = typeof rawFrom === "string" ? rawFrom : rawFrom.toISOString();
    from = new Date(dateOnly(value) ? `${value}T00:00:00.000Z` : value);
    if (Number.isNaN(from.getTime())) {
      throw validationFailed("Range awal tidak valid.");
    }
  }
  if (rawTo !== null) {
    const value = typeof rawTo === "string" ? rawTo : rawTo.toISOString();
    if (dateOnly(value)) {
      to = new Date(`${value}T23:59:59.999Z`);
    } else {
      to = new Date(value);
    }
    if (Number.isNaN(to.getTime())) {
      throw validationFailed("Range akhir tidak valid.");
    }
  }
  if (from && to && from.getTime() > to.getTime()) {
    throw validationFailed("Range tanggal tidak valid.");
  }
  return { from, to };
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function jakartaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function marginPercent(grossProfit: number, sales: number): string {
  if (sales <= 0) return "0.00";
  return ((grossProfit / sales) * 100).toFixed(2);
}

async function salesAggregates(
  client: DbClient,
  bounds: Bounds,
): Promise<{ salesTotal: number; cogsTotal: number; returnsTotal: number }> {
  const from = iso(bounds.from);
  const to = iso(bounds.to);
  const [row] = await client`
    with completed as (
      select s.id, s.total_amount
      from sales s
      where s.status = 'COMPLETED'
        and (${from}::timestamptz is null or s.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or s.created_at <= ${to}::timestamptz)
    )
    select
      coalesce((select sum(total_amount) from completed), 0)::bigint as sales_total,
      coalesce((
        select sum(si.qty_base * si.unit_cost)
        from sale_items si
        join completed c on c.id = si.sale_id
      ), 0)::bigint as cogs_total,
      coalesce((
        select sum(sr.total_refund)
        from sale_returns sr
        join completed c on c.id = sr.sale_id
      ), 0)::bigint as returns_total`;
  return {
    salesTotal: Number(row.sales_total),
    cogsTotal: Number(row.cogs_total),
    returnsTotal: Number(row.returns_total),
  };
}

export async function getDashboardSummary(input: {
  range?: DateRangeView | null;
  location?: "WAREHOUSE" | "STORE" | null;
  role?: Role | null;
}): Promise<DashboardSummaryView> {
  const client = await getSqlClient();
  const bounds = boundsFor(input.range);
  const from = iso(bounds.from);
  const to = iso(bounds.to);
  const location = input.location ?? null;
  const canViewSensitive = input.role === "OWNER" || input.role === "ADMIN";

  const [aggregates, seriesRows, summary, lowStock, transfers, opnames] =
    await Promise.all([
      salesAggregates(client, bounds),
      client`
        select
          to_char(
            (s.created_at at time zone 'Asia/Jakarta')::date,
            'YYYY-MM-DD'
          ) as date,
          count(*)::int as sale_count,
          coalesce(sum(s.total_amount), 0)::bigint as total
        from sales s
        where s.status = 'COMPLETED'
          and (${from}::timestamptz is null or s.created_at >= ${from}::timestamptz)
          and (${to}::timestamptz is null or s.created_at <= ${to}::timestamptz)
        group by 1
        order by 1`,
      stockSummary(location),
      lowStockProducts(location),
      listTransfers({
        filter: { status: "PENDING" },
        page: { page: 1, pageSize: 5 },
        sort: { field: "createdAt", direction: "DESC" },
      }),
      listOpnames({
        filter: { status: "PENDING" },
        page: { page: 1, pageSize: 5 },
        sort: { field: "createdAt", direction: "DESC" },
      }),
    ]);

  let payablesDue: PayableView[] = [];
  let recentSales: SaleView[] = [];
  if (canViewSensitive) {
    const [payables, recent] = await Promise.all([
      listPayables({
        filter: {
          dueOnOrBefore: jakartaToday(),
          outstandingOnly: true,
        },
        page: { page: 1, pageSize: 100 },
        sort: { field: "dueDate", direction: "ASC" },
      }),
      listSales({
        page: { page: 1, pageSize: 10 },
        sort: { field: "createdAt", direction: "DESC" },
      }),
    ]);
    payablesDue = payables.items.filter((item) => Number(item.outstanding) > 0);
    recentSales = recent.items
      .filter((sale) => sale.status === "COMPLETED")
      .slice(0, 5);
  }

  const grossProfit =
    aggregates.salesTotal - aggregates.returnsTotal - aggregates.cogsTotal;
  return {
    asOf: new Date(),
    salesTotal: String(aggregates.salesTotal),
    cogsTotal: String(aggregates.cogsTotal),
    grossProfit: String(grossProfit),
    marginPercent: marginPercent(grossProfit, aggregates.salesTotal),
    salesSeries: seriesRows.map((row: Record<string, unknown>) => ({
      date: String(row.date),
      saleCount: Number(row.sale_count),
      total: money(row.total),
    })),
    stockStatus: {
      ok: summary.okCount,
      low: summary.lowCount,
      out: summary.outCount,
    },
    lowStock,
    payablesDue,
    recentSales,
    pendingTransfers: transfers.items,
    pendingOpnames: opnames.items,
  };
}

interface SalesReportDbRow {
  group_key: string;
  group_label: string;
  sale_count: number | string;
  qty_base: string | number | null;
  sales: string | number;
  discount: string | number;
  returns: string | number;
  cogs: string | number;
}

function mapSalesRow(row: SalesReportDbRow): SalesReportRowView {
  const sales = Number(row.sales);
  const discount = Number(row.discount);
  const returns = Number(row.returns);
  const cogs = Number(row.cogs);
  return {
    groupKey: row.group_key,
    groupLabel: row.group_label,
    saleCount: Number(row.sale_count),
    qtyBase: decimal(row.qty_base),
    sales: String(sales),
    discount: String(discount),
    returns: String(returns),
    cogs: String(cogs),
    grossProfit: String(sales - returns - cogs),
  };
}

export async function getSalesReport(input: {
  range?: DateRangeView | null;
  groupBy: "DAY" | "PRODUCT" | "CASHIER";
}): Promise<SalesReportView> {
  const client = await getSqlClient();
  const bounds = boundsFor(input.range);
  const from = iso(bounds.from);
  const to = iso(bounds.to);

  const [totalRow] = await client`
    select count(*)::int as total
    from sales s
    where s.status = 'COMPLETED'
      and (${from}::timestamptz is null or s.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or s.created_at <= ${to}::timestamptz)`;

  let rows: SalesReportDbRow[];
  if (input.groupBy === "DAY") {
    rows = (await client`
      select
        to_char(
          (s.created_at at time zone 'Asia/Jakarta')::date,
          'YYYY-MM-DD'
        ) as group_key,
        to_char(
          (s.created_at at time zone 'Asia/Jakarta')::date,
          'YYYY-MM-DD'
        ) as group_label,
        count(*)::int as sale_count,
        coalesce(sum(i.qty_base), 0) as qty_base,
        coalesce(sum(s.total_amount), 0)::bigint as sales,
        coalesce(sum(s.discount), 0)::bigint as discount,
        coalesce(sum(r.returns), 0)::bigint as returns,
        coalesce(sum(i.cogs), 0)::bigint as cogs
      from sales s
      left join (
        select sale_id, sum(qty_base) as qty_base,
          sum(qty_base * unit_cost) as cogs
        from sale_items group by sale_id
      ) i on i.sale_id = s.id
      left join (
        select sale_id, sum(total_refund) as returns
        from sale_returns group by sale_id
      ) r on r.sale_id = s.id
      where s.status = 'COMPLETED'
        and (${from}::timestamptz is null or s.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or s.created_at <= ${to}::timestamptz)
      group by 1, 2
      order by 1`) as SalesReportDbRow[];
  } else if (input.groupBy === "CASHIER") {
    rows = (await client`
      select
        s.user_id::text as group_key,
        u.name as group_label,
        count(*)::int as sale_count,
        coalesce(sum(i.qty_base), 0) as qty_base,
        coalesce(sum(s.total_amount), 0)::bigint as sales,
        coalesce(sum(s.discount), 0)::bigint as discount,
        coalesce(sum(r.returns), 0)::bigint as returns,
        coalesce(sum(i.cogs), 0)::bigint as cogs
      from sales s
      join users u on u.id = s.user_id
      left join (
        select sale_id, sum(qty_base) as qty_base,
          sum(qty_base * unit_cost) as cogs
        from sale_items group by sale_id
      ) i on i.sale_id = s.id
      left join (
        select sale_id, sum(total_refund) as returns
        from sale_returns group by sale_id
      ) r on r.sale_id = s.id
      where s.status = 'COMPLETED'
        and (${from}::timestamptz is null or s.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or s.created_at <= ${to}::timestamptz)
      group by s.user_id, u.name
      order by u.name`) as SalesReportDbRow[];
  } else {
    rows = (await client`
      select
        si.product_id::text as group_key,
        max(si.product_name) as group_label,
        count(distinct s.id)::int as sale_count,
        coalesce(sum(si.qty_base), 0) as qty_base,
        coalesce(sum(si.subtotal - si.discount), 0)::bigint as sales,
        coalesce(sum(si.discount), 0)::bigint as discount,
        coalesce(sum(r.returns), 0)::bigint as returns,
        coalesce(sum(si.qty_base * si.unit_cost), 0)::bigint as cogs
      from sale_items si
      join sales s on s.id = si.sale_id
      left join (
        select sale_item_id, sum(refund_amount) as returns
        from sale_return_items group by sale_item_id
      ) r on r.sale_item_id = si.id
      where s.status = 'COMPLETED'
        and (${from}::timestamptz is null or s.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or s.created_at <= ${to}::timestamptz)
      group by si.product_id
      order by max(si.product_name)`) as SalesReportDbRow[];
  }

  const mapped = rows.map(mapSalesRow);
  const totals = mapped.reduce(
    (sum, row) => ({
      sales: sum.sales + Number(row.sales),
      discount: sum.discount + Number(row.discount),
      returns: sum.returns + Number(row.returns),
      cogs: sum.cogs + Number(row.cogs),
    }),
    { sales: 0, discount: 0, returns: 0, cogs: 0 },
  );

  return {
    generatedAt: new Date(),
    rows: mapped,
    saleCount: Number(totalRow.total),
    salesTotal: String(totals.sales),
    discountTotal: String(totals.discount),
    returnsTotal: String(totals.returns),
    cogsTotal: String(totals.cogs),
    grossProfitTotal: String(totals.sales - totals.returns - totals.cogs),
  };
}

interface InventoryDbRow {
  product_id: string;
  location: "WAREHOUSE" | "STORE";
  opening_qty: string;
  received_qty: string;
  sold_qty: string;
  adjusted_qty: string;
  closing_qty: string;
  avg_cost: string;
  min_qty: string | null;
}

export async function getInventoryReport(input: {
  range?: DateRangeView | null;
  location?: "WAREHOUSE" | "STORE" | null;
}): Promise<InventoryReportView> {
  const client = await getSqlClient();
  const bounds = boundsFor(input.range);
  const from = iso(bounds.from);
  const to = iso(bounds.to);
  const location = input.location ?? null;

  const rows = (await client`
    with movement as (
      select
        product_id,
        location,
        coalesce(sum(case
          when ${from}::timestamptz is not null
            and created_at < ${from}::timestamptz then qty_change
          else 0 end), 0) as opening_qty,
        coalesce(sum(case
          when (${from}::timestamptz is null or created_at >= ${from}::timestamptz)
            and (${to}::timestamptz is null or created_at <= ${to}::timestamptz)
          then qty_change else 0 end), 0) as closing_qty,
        coalesce(sum(case
          when (${from}::timestamptz is null or created_at >= ${from}::timestamptz)
            and (${to}::timestamptz is null or created_at <= ${to}::timestamptz)
            and movement_type in ('PURCHASE', 'TRANSFER_IN', 'RETURN', 'SALE_VOID')
          then qty_change else 0 end), 0) as received_qty,
        coalesce(sum(case
          when (${from}::timestamptz is null or created_at >= ${from}::timestamptz)
            and (${to}::timestamptz is null or created_at <= ${to}::timestamptz)
            and movement_type in ('SALE', 'TRANSFER_OUT')
          then -qty_change else 0 end), 0) as sold_qty,
        coalesce(sum(case
          when (${from}::timestamptz is null or created_at >= ${from}::timestamptz)
            and (${to}::timestamptz is null or created_at <= ${to}::timestamptz)
            and movement_type in ('OPNAME', 'ADJUSTMENT', 'PURCHASE_CANCEL')
          then qty_change else 0 end), 0) as adjusted_qty
      from stock_movements
      where (${location}::text is null or location::text = ${location})
      group by product_id, location
    )
    select
      m.product_id, m.location, m.opening_qty, m.received_qty, m.sold_qty,
      m.adjusted_qty, m.closing_qty, p.avg_cost, t.min_qty
    from movement m
    join products p on p.id = m.product_id
    left join product_stock_thresholds t
      on t.product_id = m.product_id and t.location = m.location
    order by p.name, m.location`) as InventoryDbRow[];

  const products = await loadProductsByIds([
    ...new Set(rows.map((row) => row.product_id)),
  ]);
  const result: InventoryReportRowView[] = [];
  let totalValue = 0;
  let lowCount = 0;
  let outCount = 0;

  for (const row of rows) {
    const product = products.get(row.product_id);
    if (!product) continue;
    const closing = Number(row.closing_qty);
    const minQty = row.min_qty === null ? null : Number(row.min_qty);
    const status =
      closing <= 0
        ? "OUT"
        : minQty !== null && closing <= minQty
          ? "LOW"
          : "OK";
    if (status === "LOW") lowCount += 1;
    if (status === "OUT") outCount += 1;
    const value = Math.round(closing * Number(row.avg_cost));
    totalValue += value;
    result.push({
      product,
      location: row.location,
      openingQty: toQuantity(Number(row.opening_qty)),
      receivedQty: toQuantity(Number(row.received_qty)),
      soldQty: toQuantity(Number(row.sold_qty)),
      adjustedQty: toQuantity(Number(row.adjusted_qty)),
      closingQty: toQuantity(closing),
      avgCost: money(row.avg_cost),
      value: String(value),
      minQty: row.min_qty === null ? null : decimal(row.min_qty),
      status,
    });
  }

  return {
    generatedAt: new Date(),
    rows: result,
    totalValue: String(totalValue),
    lowCount,
    outCount,
  };
}

interface FinanceCategoryDbRow {
  category: FinanceCategoryRowView["category"];
  type: "IN" | "OUT";
  amount: string;
  count: number | string;
}

export async function getFinanceReport(input: {
  range?: DateRangeView | null;
}): Promise<FinanceReportView> {
  const client = await getSqlClient();
  const bounds = boundsFor(input.range);
  const from = iso(bounds.from);
  const to = iso(bounds.to);

  const [categoryRows, receivableRow, payableRow] = await Promise.all([
    client`
      select
        category, type, coalesce(sum(amount), 0)::bigint as amount,
        count(*)::int as count
      from cash_flows
      where (${from}::timestamptz is null or created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or created_at <= ${to}::timestamptz)
      group by category, type
      order by category, type`,
    client`
      select coalesce(sum(outstanding), 0)::bigint as outstanding
      from v_sale_balances`,
    client`
      select coalesce(sum(outstanding), 0)::bigint as outstanding
      from v_purchase_balances`,
  ]);

  const byCategory = (categoryRows as unknown as FinanceCategoryDbRow[]).map(
    (row) => ({
      category: row.category,
      type: row.type,
      amount: money(row.amount),
      count: Number(row.count),
    }),
  );
  const cashIn = byCategory
    .filter((row) => row.type === "IN")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const cashOut = byCategory
    .filter((row) => row.type === "OUT")
    .reduce((sum, row) => sum + Number(row.amount), 0);

  return {
    generatedAt: new Date(),
    cashIn: String(cashIn),
    cashOut: String(cashOut),
    netCash: String(cashIn - cashOut),
    byCategory,
    receivablesOutstanding: money(
      (receivableRow[0] as { outstanding: string } | undefined)?.outstanding,
    ),
    payablesOutstanding: money(
      (payableRow[0] as { outstanding: string } | undefined)?.outstanding,
    ),
  };
}

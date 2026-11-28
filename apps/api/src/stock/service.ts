import { findUserById } from "../auth/repository.ts";
import { userRowToContextUser } from "../auth/user-mapper.ts";
import {
  loadProductsByIds,
  type ProductUnitView,
  type ProductView,
} from "../catalog/service.ts";
import {
  type DbClient,
  decimal,
  documentNumber,
  getSqlClient,
  normalizePage,
  type PageInfo,
  pageInfo,
  resolveSort,
  toDate,
  toQuantity,
} from "../db/query.ts";
import type { RequestContext } from "../graphql/context.ts";
import type { ContextUser } from "../graphql/context.ts";
import { conflict, notFound, validationFailed } from "../graphql/errors.ts";
import {
  createPurchaseRecord,
  getPurchase,
  type PurchaseView,
} from "../purchasing/service.ts";

export interface StockBalanceView {
  productId: string;
  product: ProductView;
  location: "WAREHOUSE" | "STORE";
  qty: string;
  minQty: string | null;
  status: "OK" | "LOW" | "OUT";
  isNegative: boolean;
}

export interface StockMovementView {
  id: string;
  productId: string;
  product: ProductView;
  location: "WAREHOUSE" | "STORE";
  qtyChange: string;
  movementType:
    | "PURCHASE"
    | "PURCHASE_CANCEL"
    | "SALE"
    | "TRANSFER_OUT"
    | "TRANSFER_IN"
    | "OPNAME"
    | "RETURN"
    | "SALE_VOID"
    | "ADJUSTMENT";
  referenceType:
    "PURCHASE" | "SALE" | "TRANSFER" | "OPNAME" | "RETURN" | "MANUAL";
  referenceId: string | null;
  notes: string | null;
  flagged: boolean;
  flagReason: string | null;
  createdBy: ContextUser;
  createdAt: Date | string;
}

export interface StockLocationSummaryView {
  location: "WAREHOUSE" | "STORE";
  totalQty: string;
  value: string;
}

export interface StockSummaryView {
  asOf: Date;
  okCount: number;
  lowCount: number;
  outCount: number;
  negativeCount: number;
  totalValue: string;
  byLocation: StockLocationSummaryView[];
}

export interface StockTransferItemView {
  id: string;
  productId: string;
  productUnitId: string;
  product: ProductView;
  unit: ProductUnitView;
  qty: string;
  qtyBase: string;
}

export interface StockTransferView {
  id: string;
  transferNo: string;
  fromLocation: "WAREHOUSE" | "STORE";
  toLocation: "WAREHOUSE" | "STORE";
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  createdBy: ContextUser;
  reviewedBy: ContextUser | null;
  reviewedAt: Date | string | null;
  completedAt: Date | string | null;
  cancelledBy: ContextUser | null;
  cancelledAt: Date | string | null;
  items: StockTransferItemView[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface StockOpnameItemView {
  id: string;
  productId: string;
  product: ProductView;
  systemQty: string;
  physicalQty: string;
  diffQty: string;
}

export interface StockOpnameView {
  id: string;
  opnameNo: string;
  location: "WAREHOUSE" | "STORE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdBy: ContextUser;
  reviewedBy: ContextUser | null;
  reviewedAt: Date | string | null;
  submittedAt: Date | string | null;
  items: StockOpnameItemView[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface StockPayloadView {
  purchase: PurchaseView | null;
  opname: StockOpnameView | null;
  movements: StockMovementView[];
}

export interface StockBalancePageView {
  items: StockBalanceView[];
  pageInfo: PageInfo;
}

export interface StockMovementPageView {
  items: StockMovementView[];
  pageInfo: PageInfo;
}

export interface TransferPageView {
  items: StockTransferView[];
  pageInfo: PageInfo;
}

export interface OpnamePageView {
  items: StockOpnameView[];
  pageInfo: PageInfo;
}

async function loadUser(id: string | null): Promise<ContextUser | null> {
  if (!id) return null;
  const row = await findUserById(id);
  return row ? userRowToContextUser(row, null) : null;
}

async function loadUsers(
  ids: Array<string | null>,
): Promise<Map<string, ContextUser>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const entries = await Promise.all(
    unique.map(async (id) => [id, await loadUser(id)] as const),
  );
  return new Map(
    entries.filter(
      (entry): entry is [string, ContextUser] => entry[1] !== null,
    ),
  );
}

function balanceStatus(
  qty: number,
  minQty: number | null,
): "OK" | "LOW" | "OUT" {
  if (qty <= 0) return "OUT";
  if (minQty !== null && qty <= minQty) return "LOW";
  return "OK";
}

interface BalanceRow {
  product_id: string;
  location: "WAREHOUSE" | "STORE";
  qty: string;
  is_negative: boolean;
  min_qty: string | null;
}

interface MovementRow {
  id: string;
  product_id: string;
  location: "WAREHOUSE" | "STORE";
  qty_change: string;
  movement_type: StockMovementView["movementType"];
  reference_type: StockMovementView["referenceType"];
  reference_id: string | null;
  notes: string | null;
  flagged: boolean;
  flag_reason: string | null;
  created_by: string;
  created_at: Date;
}

async function hydrateBalances(
  rows: BalanceRow[],
): Promise<StockBalanceView[]> {
  const products = await loadProductsByIds([
    ...new Set(rows.map((row) => row.product_id)),
  ]);
  const result: StockBalanceView[] = [];
  for (const row of rows) {
    const product = products.get(row.product_id);
    if (!product) continue;
    const qty = Number(row.qty);
    const minQty = row.min_qty === null ? null : Number(row.min_qty);
    result.push({
      productId: row.product_id,
      product,
      location: row.location,
      qty: decimal(row.qty),
      minQty: row.min_qty === null ? null : decimal(row.min_qty),
      status: balanceStatus(qty, minQty),
      isNegative: row.is_negative,
    });
  }
  return result;
}

export async function listStockBalances(input: {
  filter?: {
    productId?: string | null;
    search?: string | null;
    location?: string | null;
    status?: string | null;
    belowMinimum?: boolean | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<StockBalancePageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      productName: "p.name",
      qty: "b.qty",
      location: "b.location",
      status: "status",
    },
    "p.name",
  );
  const productId = input.filter?.productId ?? null;
  const search = input.filter?.search ? `%${input.filter.search}%` : null;
  const location = input.filter?.location ?? null;
  const status = input.filter?.status ?? null;
  const belowMinimum = input.filter?.belowMinimum ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from v_stock_balances b
    join products p on p.id = b.product_id
    left join product_stock_thresholds t
      on t.product_id = b.product_id and t.location = b.location
    where     (${productId}::uuid is null or b.product_id = ${productId}::uuid)
    and (${search}::text is null or p.name ilike ${search} or p.sku ilike ${search})
    and (${location}::text is null or b.location::text = ${location})
    and (${status}::text is null or
      (case when b.qty <= 0 then 'OUT'
            when t.min_qty is not null and b.qty <= t.min_qty then 'LOW'
            else 'OK' end) = ${status})
    and (${belowMinimum}::boolean is null
      or (${belowMinimum}::boolean = true and t.min_qty is not null and b.qty <= t.min_qty)
      or (${belowMinimum}::boolean = false and (t.min_qty is null or b.qty > t.min_qty)))`;

  const rows = (await client`
    select
      b.product_id, b.location, b.qty, b.is_negative, t.min_qty,
      case when b.qty <= 0 then 'OUT'
           when t.min_qty is not null and b.qty <= t.min_qty then 'LOW'
           else 'OK' end as status
    from v_stock_balances b
    join products p on p.id = b.product_id
    left join product_stock_thresholds t
      on t.product_id = b.product_id and t.location = b.location
    where     (${productId}::uuid is null or b.product_id = ${productId}::uuid)
    and (${search}::text is null or p.name ilike ${search} or p.sku ilike ${search})
    and (${location}::text is null or b.location::text = ${location})
    and (${status}::text is null or
      (case when b.qty <= 0 then 'OUT'
            when t.min_qty is not null and b.qty <= t.min_qty then 'LOW'
            else 'OK' end) = ${status})
    and (${belowMinimum}::boolean is null
      or (${belowMinimum}::boolean = true and t.min_qty is not null and b.qty <= t.min_qty)
      or (${belowMinimum}::boolean = false and (t.min_qty is null or b.qty > t.min_qty)))
    order by ${order.expression === "status" ? client`status` : client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`) as BalanceRow[];

  return {
    items: await hydrateBalances(rows),
    pageInfo: pageInfo(page, Number(countRow.total)),
  };
}

export async function lowStockProducts(
  location: "WAREHOUSE" | "STORE" | null,
): Promise<StockBalanceView[]> {
  const client = await getSqlClient();
  const rows = (await client`
    select
      b.product_id, b.location, b.qty, b.is_negative, t.min_qty,
      case when b.qty <= 0 then 'OUT'
           when t.min_qty is not null and b.qty <= t.min_qty then 'LOW'
           else 'OK' end as status
    from v_stock_balances b
    join products p on p.id = b.product_id
    left join product_stock_thresholds t
      on t.product_id = b.product_id and t.location = b.location
    where (${location}::text is null or b.location::text = ${location})
      and (b.qty <= 0 or (t.min_qty is not null and b.qty <= t.min_qty))
    order by b.qty, p.name`) as BalanceRow[];
  return hydrateBalances(rows);
}

export async function stockSummary(
  location: "WAREHOUSE" | "STORE" | null,
): Promise<StockSummaryView> {
  const client = await getSqlClient();
  const rows = await client`
    select
      b.product_id, b.location, b.qty, b.is_negative, t.min_qty,
      p.avg_cost
    from v_stock_balances b
    join products p on p.id = b.product_id
    left join product_stock_thresholds t
      on t.product_id = b.product_id and t.location = b.location
    where (${location}::text is null or b.location::text = ${location})`;

  let okCount = 0;
  let lowCount = 0;
  let outCount = 0;
  let negativeCount = 0;
  let totalValue = 0;
  const byLocation = new Map<
    "WAREHOUSE" | "STORE",
    { qty: number; value: number }
  >();

  for (const row of rows) {
    const qty = Number(row.qty);
    const minQty = row.min_qty === null ? null : Number(row.min_qty);
    const status = balanceStatus(qty, minQty);
    if (status === "OK") okCount += 1;
    if (status === "LOW") lowCount += 1;
    if (status === "OUT") outCount += 1;
    if (row.is_negative) negativeCount += 1;

    const value = Math.round(qty * Number(row.avg_cost));
    totalValue += value;
    const summary = byLocation.get(row.location) ?? { qty: 0, value: 0 };
    summary.qty += qty;
    summary.value += value;
    byLocation.set(row.location, summary);
  }

  return {
    asOf: new Date(),
    okCount,
    lowCount,
    outCount,
    negativeCount,
    totalValue: String(totalValue),
    byLocation: [...byLocation.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([loc, summary]) => ({
        location: loc,
        totalQty: decimal(summary.qty),
        value: String(summary.value),
      })),
  };
}

async function hydrateMovements(
  rows: MovementRow[],
): Promise<StockMovementView[]> {
  const products = await loadProductsByIds([
    ...new Set(rows.map((row) => row.product_id)),
  ]);
  const users = await loadUsers(rows.map((row) => row.created_by));
  const result: StockMovementView[] = [];
  for (const row of rows) {
    const product = products.get(row.product_id);
    const user = users.get(row.created_by);
    if (!product || !user) continue;
    result.push({
      id: row.id,
      productId: row.product_id,
      product,
      location: row.location,
      qtyChange: decimal(row.qty_change),
      movementType: row.movement_type,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      notes: row.notes,
      flagged: row.flagged,
      flagReason: row.flag_reason,
      createdBy: user,
      createdAt: row.created_at,
    });
  }
  return result;
}

export async function listStockMovements(input: {
  filter?: {
    productId?: string | null;
    location?: string | null;
    movementType?: string | null;
    referenceType?: string | null;
    flagged?: boolean | null;
    range?: { from?: Date | null; to?: Date | null } | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<StockMovementPageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      createdAt: "sm.created_at",
      qtyChange: "sm.qty_change",
      movementType: "sm.movement_type",
    },
    "sm.created_at",
  );
  const productId = input.filter?.productId ?? null;
  const location = input.filter?.location ?? null;
  const movementType = input.filter?.movementType ?? null;
  const referenceType = input.filter?.referenceType ?? null;
  const flagged = input.filter?.flagged ?? null;
  const from = toDate(input.filter?.range?.from)?.toISOString() ?? null;
  const to = toDate(input.filter?.range?.to)?.toISOString() ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total from stock_movements sm where     (${productId}::uuid is null or sm.product_id = ${productId}::uuid)
    and (${location}::text is null or sm.location::text = ${location})
    and (${movementType}::text is null or sm.movement_type::text = ${movementType})
    and (${referenceType}::text is null or sm.reference_type::text = ${referenceType})
    and (${flagged}::boolean is null or sm.flagged = ${flagged})
    and (${from}::timestamptz is null or sm.created_at >= ${from}::timestamptz)
    and (${to}::timestamptz is null or sm.created_at <= ${to}::timestamptz)`;

  const rows = (await client`
    select
      sm.id, sm.product_id, sm.location, sm.qty_change, sm.movement_type,
      sm.reference_type, sm.reference_id, sm.notes, sm.flagged,
      sm.flag_reason, sm.created_by, sm.created_at
    from stock_movements sm
    where     (${productId}::uuid is null or sm.product_id = ${productId}::uuid)
    and (${location}::text is null or sm.location::text = ${location})
    and (${movementType}::text is null or sm.movement_type::text = ${movementType})
    and (${referenceType}::text is null or sm.reference_type::text = ${referenceType})
    and (${flagged}::boolean is null or sm.flagged = ${flagged})
    and (${from}::timestamptz is null or sm.created_at >= ${from}::timestamptz)
    and (${to}::timestamptz is null or sm.created_at <= ${to}::timestamptz)
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`) as MovementRow[];

  return {
    items: await hydrateMovements(rows),
    pageInfo: pageInfo(page, Number(countRow.total)),
  };
}

async function loadMovementsByReference(
  referenceType: "PURCHASE",
  referenceId: string,
): Promise<StockMovementView[]> {
  const client = await getSqlClient();
  const rows = (await client`
    select
      id, product_id, location, qty_change, movement_type, reference_type,
      reference_id, notes, flagged, flag_reason, created_by, created_at
    from stock_movements
    where reference_type = ${referenceType} and reference_id = ${referenceId}
    order by created_at, id`) as MovementRow[];
  return hydrateMovements(rows);
}

export async function receiveStock(
  context: RequestContext,
  input: {
    supplierId: string;
    supplierInvoiceNo?: string | null;
    dueDate?: string | null;
    location?: "WAREHOUSE" | "STORE" | null;
    notes?: string | null;
    items: Array<{
      productId: string;
      productUnitId: string;
      qty: string;
      unitCost: string;
    }>;
  },
): Promise<StockPayloadView> {
  const client = await getSqlClient();
  const purchaseId = await client.begin((transaction) =>
    createPurchaseRecord(transaction, context, input, {
      location: input.location ?? null,
      notes: input.notes ?? null,
    }),
  );
  const purchase = await getPurchase(purchaseId);
  if (!purchase) throw notFound("Pembelian tidak ditemukan.");
  return {
    purchase,
    opname: null,
    movements: await loadMovementsByReference("PURCHASE", purchaseId),
  };
}

async function currentBalance(
  client: DbClient,
  productId: string,
  location: string,
): Promise<number> {
  const [row] = await client`
    select coalesce(sum(qty_change), 0)::numeric(12,3) as qty
    from stock_movements
    where product_id = ${productId} and location = ${location}`;
  return Number(row.qty);
}

async function lockProducts(
  client: DbClient,
  productIds: string[],
): Promise<void> {
  const ids = [...new Set(productIds)].sort();
  if (ids.length === 0) return;
  const rows = await client`
    select id from products where id = any(${ids}::uuid[])
    order by id for update`;
  if (rows.length !== ids.length) throw notFound("Produk tidak ditemukan.");
}

export async function adjustStock(
  context: RequestContext,
  input: {
    location: "WAREHOUSE" | "STORE";
    productId: string;
    physicalQty: string;
    systemQty?: string | null;
    reason: string;
  },
): Promise<StockPayloadView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const physical = Number(input.physicalQty);
  if (!Number.isFinite(physical) || physical < 0) {
    throw validationFailed("physicalQty tidak valid.");
  }

  const client = await getSqlClient();
  const opnameId = await client.begin(async (transaction) => {
    await lockProducts(transaction, [input.productId]);
    const system = await currentBalance(
      transaction,
      input.productId,
      input.location,
    );
    if (input.systemQty !== undefined && input.systemQty !== null) {
      if (Math.abs(Number(input.systemQty) - system) > 0.0005) {
        throw conflict("systemQty tidak cocok dengan saldo server.");
      }
    }

    const [opname] = await transaction`
      insert into stock_opnames (opname_no, location, status, created_by)
      values (${documentNumber("OPN")}, ${input.location}, 'PENDING', ${context.user!.id})
      returning id`;
    await transaction`
      insert into stock_opname_items (
        opname_id, product_id, system_qty, physical_qty, diff_qty
      )
      values (
        ${opname.id}, ${input.productId}, ${toQuantity(system)},
        ${toQuantity(physical)}, ${toQuantity(physical - system)}
      )`;
    return opname.id as string;
  });

  const opname = await getOpname(opnameId);
  if (!opname) throw notFound("Opname tidak ditemukan.");
  return { purchase: null, opname, movements: [] };
}

interface TransferLine {
  productId: string;
  productUnitId: string;
  qty: string;
  qtyBase: string;
}

async function prepareTransferLines(
  client: DbClient,
  items: Array<{ productId: string; productUnitId: string; qty: string }>,
): Promise<TransferLine[]> {
  if (items.length === 0) throw validationFailed("Item transfer wajib diisi.");
  await lockProducts(
    client,
    items.map((item) => item.productId),
  );
  const productIds = [...new Set(items.map((item) => item.productId))];
  const units = await client`
    select id, product_id, conversion_qty
    from product_units
    where product_id = any(${productIds}::uuid[])`;
  const unitMap = new Map(
    units.map((unit: Record<string, unknown>) => [unit.id, unit]),
  );
  return items.map((item) => {
    const unit = unitMap.get(item.productUnitId) as
      { product_id: string; conversion_qty: string } | undefined;
    if (!unit || unit.product_id !== item.productId) {
      throw validationFailed("productUnitId tidak sesuai dengan produk.");
    }
    const qty = Number(item.qty);
    if (!(qty > 0)) throw validationFailed("qty harus lebih dari 0.");
    return {
      productId: item.productId,
      productUnitId: item.productUnitId,
      qty: toQuantity(qty),
      qtyBase: toQuantity(qty * Number(unit.conversion_qty)),
    };
  });
}

export async function createTransfer(
  context: RequestContext,
  input: {
    fromLocation: "WAREHOUSE" | "STORE";
    toLocation: "WAREHOUSE" | "STORE";
    items: Array<{ productId: string; productUnitId: string; qty: string }>;
  },
): Promise<StockTransferView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  if (input.fromLocation === input.toLocation) {
    throw validationFailed("Lokasi asal dan tujuan harus berbeda.");
  }

  const client = await getSqlClient();
  const transferId = await client.begin(async (transaction) => {
    const lines = await prepareTransferLines(transaction, input.items);
    const [transfer] = await transaction`
      insert into stock_transfers (
        transfer_no, from_location, to_location, status, created_by
      )
      values (
        ${documentNumber("TRF")}, ${input.fromLocation}, ${input.toLocation},
        'PENDING', ${context.user!.id}
      )
      returning id`;
    for (const line of lines) {
      await transaction`
        insert into stock_transfer_items (
          transfer_id, product_id, product_unit_id, qty, qty_base
        )
        values (
          ${transfer.id}, ${line.productId}, ${line.productUnitId},
          ${line.qty}, ${line.qtyBase}
        )`;
    }
    return transfer.id as string;
  });

  const transfer = await getTransfer(transferId);
  if (!transfer) throw notFound("Transfer tidak ditemukan.");
  return transfer;
}

export async function completeTransfer(
  context: RequestContext,
  id: string,
): Promise<StockTransferView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const client = await getSqlClient();

  await client.begin(async (transaction) => {
    const [transfer] = await transaction`
      select id, transfer_no, from_location, to_location, status
      from stock_transfers where id = ${id} for update`;
    if (!transfer) throw notFound("Transfer tidak ditemukan.");
    if (transfer.status === "COMPLETED") return;
    if (transfer.status !== "PENDING")
      throw conflict("Transfer tidak bisa diselesaikan.");

    const items = (await transaction`
      select product_id, product_unit_id, qty_base
      from stock_transfer_items where transfer_id = ${id}`) as Array<{
      product_id: string;
      product_unit_id: string;
      qty_base: string;
    }>;
    await lockProducts(
      transaction,
      items.map((item) => item.product_id),
    );

    const productIds = [...new Set(items.map((item) => item.product_id))];
    const balances = (await transaction`
      select product_id, location, coalesce(sum(qty_change), 0)::numeric(12,3) as qty
      from stock_movements
      where product_id = any(${productIds}::uuid[])
      group by product_id, location`) as Array<{
      product_id: string;
      location: string;
      qty: string;
    }>;
    const balanceMap = new Map(
      balances.map((row) => [
        `${row.product_id}:${row.location}`,
        Number(row.qty),
      ]),
    );

    for (const item of items) {
      const base = Number(item.qty_base);
      const fromKey = `${item.product_id}:${transfer.from_location}`;
      const toKey = `${item.product_id}:${transfer.to_location}`;
      const fromQty = (balanceMap.get(fromKey) ?? 0) - base;
      const toQty = (balanceMap.get(toKey) ?? 0) + base;
      balanceMap.set(fromKey, fromQty);
      balanceMap.set(toKey, toQty);

      await transaction`
        insert into stock_movements (
          product_id, location, qty_change, movement_type, reference_type,
          reference_id, notes, flagged, flag_reason, created_by
        )
        values (
          ${item.product_id}, ${transfer.from_location}, ${-base},
          'TRANSFER_OUT', 'TRANSFER', ${id}, ${transfer.transfer_no},
          ${fromQty < 0}, ${fromQty < 0 ? "NEGATIVE_STOCK" : null},
          ${context.user!.id}
        )`;
      await transaction`
        insert into stock_movements (
          product_id, location, qty_change, movement_type, reference_type,
          reference_id, notes, flagged, flag_reason, created_by
        )
        values (
          ${item.product_id}, ${transfer.to_location}, ${base},
          'TRANSFER_IN', 'TRANSFER', ${id}, ${transfer.transfer_no},
          ${toQty < 0}, ${toQty < 0 ? "NEGATIVE_STOCK" : null},
          ${context.user!.id}
        )`;
    }

    await transaction`
      update stock_transfers
      set
        status = 'COMPLETED',
        reviewed_by = ${context.user!.id},
        reviewed_at = now(),
        completed_at = now(),
        updated_at = now()
      where id = ${id}`;
  });

  const transfer = await getTransfer(id);
  if (!transfer) throw notFound("Transfer tidak ditemukan.");
  return transfer;
}

export async function cancelTransfer(
  context: RequestContext,
  id: string,
): Promise<StockTransferView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const client = await getSqlClient();

  await client.begin(async (transaction) => {
    const [transfer] = await transaction`
      select id, status from stock_transfers where id = ${id} for update`;
    if (!transfer) throw notFound("Transfer tidak ditemukan.");
    if (transfer.status === "CANCELLED") return;
    if (transfer.status !== "PENDING")
      throw conflict("Transfer tidak bisa dibatalkan.");

    await transaction`
      update stock_transfers
      set
        status = 'CANCELLED',
        cancelled_by = ${context.user!.id},
        cancelled_at = now(),
        updated_at = now()
      where id = ${id}`;
  });

  const transfer = await getTransfer(id);
  if (!transfer) throw notFound("Transfer tidak ditemukan.");
  return transfer;
}

export async function getTransfer(
  id: string,
): Promise<StockTransferView | null> {
  const client = await getSqlClient();
  const [row] = await client`
    select
      id, transfer_no, from_location, to_location, status, created_by,
      reviewed_by, reviewed_at, completed_at, cancelled_by, cancelled_at,
      created_at, updated_at
    from stock_transfers
    where id = ${id}
    limit 1`;
  if (!row) return null;
  return buildTransfer(row);
}

async function buildTransfer(
  row: Record<string, unknown>,
): Promise<StockTransferView> {
  const client = await getSqlClient();
  const itemRows = (await client`
    select id, product_id, product_unit_id, qty, qty_base
    from stock_transfer_items
    where transfer_id = ${row.id as string}
    order by id`) as Array<{
    id: string;
    product_id: string;
    product_unit_id: string;
    qty: string;
    qty_base: string;
  }>;
  const products = await loadProductsByIds([
    ...new Set(itemRows.map((item) => item.product_id)),
  ]);
  const items: StockTransferItemView[] = [];
  for (const item of itemRows) {
    const product = products.get(item.product_id);
    const unit = product?.units.find(
      (value) => value.id === item.product_unit_id,
    );
    if (!product || !unit) continue;
    items.push({
      id: item.id,
      productId: item.product_id,
      productUnitId: item.product_unit_id,
      product,
      unit,
      qty: decimal(item.qty),
      qtyBase: decimal(item.qty_base),
    });
  }

  const users = await loadUsers([
    row.created_by as string,
    row.reviewed_by as string | null,
    row.cancelled_by as string | null,
  ]);
  const createdBy = users.get(row.created_by as string);
  if (!createdBy) throw notFound("Pembuat transfer tidak ditemukan.");

  return {
    id: row.id as string,
    transferNo: row.transfer_no as string,
    fromLocation: row.from_location as "WAREHOUSE" | "STORE",
    toLocation: row.to_location as "WAREHOUSE" | "STORE",
    status: row.status as StockTransferView["status"],
    createdBy,
    reviewedBy: row.reviewed_by
      ? (users.get(row.reviewed_by as string) ?? null)
      : null,
    reviewedAt: row.reviewed_at as Date | null,
    completedAt: row.completed_at as Date | null,
    cancelledBy: row.cancelled_by
      ? (users.get(row.cancelled_by as string) ?? null)
      : null,
    cancelledAt: row.cancelled_at as Date | null,
    items,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function listTransfers(input: {
  filter?: {
    search?: string | null;
    status?: string | null;
    location?: string | null;
    range?: { from?: Date | null; to?: Date | null } | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<TransferPageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      transferNo: "t.transfer_no",
      createdAt: "t.created_at",
      updatedAt: "t.updated_at",
      status: "t.status",
    },
    "t.created_at",
  );
  const search = input.filter?.search ? `%${input.filter.search}%` : null;
  const status = input.filter?.status ?? null;
  const location = input.filter?.location ?? null;
  const from = toDate(input.filter?.range?.from)?.toISOString() ?? null;
  const to = toDate(input.filter?.range?.to)?.toISOString() ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from stock_transfers t
    where (${search}::text is null or t.transfer_no ilike ${search})
      and (${status}::text is null or t.status::text = ${status})
      and (${location}::text is null
        or t.from_location::text = ${location} or t.to_location::text = ${location})
      and (${from}::timestamptz is null or t.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or t.created_at <= ${to}::timestamptz)`;

  const rows = await client`
    select
      id, transfer_no, from_location, to_location, status, created_by,
      reviewed_by, reviewed_at, completed_at, cancelled_by, cancelled_at,
      created_at, updated_at
    from stock_transfers t
    where (${search}::text is null or t.transfer_no ilike ${search})
      and (${status}::text is null or t.status::text = ${status})
      and (${location}::text is null
        or t.from_location::text = ${location} or t.to_location::text = ${location})
      and (${from}::timestamptz is null or t.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or t.created_at <= ${to}::timestamptz)
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`;

  return {
    items: await Promise.all(
      rows.map((row: Record<string, unknown>) => buildTransfer(row)),
    ),
    pageInfo: pageInfo(page, Number(countRow.total)),
  };
}

interface OpnameLineInput {
  productId: string;
  physicalQty: string;
}

async function prepareOpnameLines(
  client: DbClient,
  location: "WAREHOUSE" | "STORE",
  items: OpnameLineInput[],
): Promise<
  Array<{
    productId: string;
    systemQty: string;
    physicalQty: string;
    diffQty: string;
  }>
> {
  if (items.length === 0) throw validationFailed("Item opname wajib diisi.");
  const productIds = items.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw validationFailed("Produk opname tidak boleh duplikat.");
  }
  await lockProducts(client, productIds);

  const balances = (await client`
    select product_id, coalesce(sum(qty_change), 0)::numeric(12,3) as qty
    from stock_movements
    where product_id = any(${productIds}::uuid[]) and location = ${location}
    group by product_id`) as Array<{
    product_id: string;
    qty: string;
  }>;
  const balanceMap = new Map(
    balances.map((row) => [row.product_id, Number(row.qty)]),
  );

  return items.map((item) => {
    const physical = Number(item.physicalQty);
    if (!Number.isFinite(physical) || physical < 0) {
      throw validationFailed("physicalQty tidak valid.");
    }
    const system = balanceMap.get(item.productId) ?? 0;
    return {
      productId: item.productId,
      systemQty: toQuantity(system),
      physicalQty: toQuantity(physical),
      diffQty: toQuantity(physical - system),
    };
  });
}

export async function createOpname(
  context: RequestContext,
  input: {
    location: "WAREHOUSE" | "STORE";
    items: OpnameLineInput[];
  },
): Promise<StockOpnameView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const client = await getSqlClient();
  const opnameId = await client.begin(async (transaction) => {
    const lines = await prepareOpnameLines(
      transaction,
      input.location,
      input.items,
    );
    const [opname] = await transaction`
      insert into stock_opnames (opname_no, location, status, created_by)
      values (${documentNumber("OPN")}, ${input.location}, 'PENDING', ${context.user!.id})
      returning id`;
    for (const line of lines) {
      await transaction`
        insert into stock_opname_items (
          opname_id, product_id, system_qty, physical_qty, diff_qty
        )
        values (
          ${opname.id}, ${line.productId}, ${line.systemQty},
          ${line.physicalQty}, ${line.diffQty}
        )`;
    }
    return opname.id as string;
  });

  const opname = await getOpname(opnameId);
  if (!opname) throw notFound("Opname tidak ditemukan.");
  return opname;
}

export async function updateOpname(
  context: RequestContext,
  id: string,
  input: { items: OpnameLineInput[] },
): Promise<StockOpnameView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const client = await getSqlClient();

  await client.begin(async (transaction) => {
    const [opname] = await transaction`
      select id, location, status, submitted_at
      from stock_opnames where id = ${id} for update`;
    if (!opname) throw notFound("Opname tidak ditemukan.");
    if (opname.status !== "PENDING") throw conflict("Opname sudah direview.");
    if (opname.submitted_at)
      throw conflict("Opname sudah dikirim untuk review.");

    const lines = await prepareOpnameLines(
      transaction,
      opname.location,
      input.items,
    );
    await transaction`delete from stock_opname_items where opname_id = ${id}`;
    for (const line of lines) {
      await transaction`
        insert into stock_opname_items (
          opname_id, product_id, system_qty, physical_qty, diff_qty
        )
        values (
          ${id}, ${line.productId}, ${line.systemQty},
          ${line.physicalQty}, ${line.diffQty}
        )`;
    }
    await transaction`
      update stock_opnames set updated_at = now() where id = ${id}`;
  });

  const opname = await getOpname(id);
  if (!opname) throw notFound("Opname tidak ditemukan.");
  return opname;
}

export async function submitOpname(
  context: RequestContext,
  id: string,
): Promise<StockOpnameView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const client = await getSqlClient();
  await client.begin(async (transaction) => {
    const [opname] = await transaction`
      select id, status from stock_opnames where id = ${id} for update`;
    if (!opname) throw notFound("Opname tidak ditemukan.");
    if (opname.status !== "PENDING") throw conflict("Opname sudah direview.");
    await transaction`
      update stock_opnames
      set submitted_at = coalesce(submitted_at, now()), updated_at = now()
      where id = ${id}`;
  });
  const opname = await getOpname(id);
  if (!opname) throw notFound("Opname tidak ditemukan.");
  return opname;
}

export async function approveOpname(
  context: RequestContext,
  id: string,
): Promise<StockOpnameView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const client = await getSqlClient();

  await client.begin(async (transaction) => {
    const [opname] = await transaction`
      select id, opname_no, location, status
      from stock_opnames where id = ${id} for update`;
    if (!opname) throw notFound("Opname tidak ditemukan.");
    if (opname.status === "APPROVED") return;
    if (opname.status !== "PENDING") throw conflict("Opname sudah ditolak.");

    const items = (await transaction`
      select product_id, diff_qty
      from stock_opname_items where opname_id = ${id}`) as Array<{
      product_id: string;
      diff_qty: string;
    }>;
    await lockProducts(
      transaction,
      items.map((item) => item.product_id),
    );

    const productIds = [...new Set(items.map((item) => item.product_id))];
    const balances = (await transaction`
      select product_id, coalesce(sum(qty_change), 0)::numeric(12,3) as qty
      from stock_movements
      where product_id = any(${productIds}::uuid[]) and location = ${opname.location}
      group by product_id`) as Array<{
      product_id: string;
      qty: string;
    }>;
    const balanceMap = new Map(
      balances.map((row) => [row.product_id, Number(row.qty)]),
    );

    for (const item of items) {
      const diff = Number(item.diff_qty);
      if (diff === 0) continue;
      const next = (balanceMap.get(item.product_id) ?? 0) + diff;
      balanceMap.set(item.product_id, next);
      await transaction`
        insert into stock_movements (
          product_id, location, qty_change, movement_type, reference_type,
          reference_id, notes, flagged, flag_reason, created_by
        )
        values (
          ${item.product_id}, ${opname.location}, ${toQuantity(diff)},
          'OPNAME', 'OPNAME', ${id}, ${opname.opname_no},
          ${next < 0}, ${next < 0 ? "NEGATIVE_STOCK" : null},
          ${context.user!.id}
        )`;
    }

    await transaction`
      update stock_opnames
      set
        status = 'APPROVED',
        reviewed_by = ${context.user!.id},
        reviewed_at = now(),
        updated_at = now()
      where id = ${id}`;
  });

  const opname = await getOpname(id);
  if (!opname) throw notFound("Opname tidak ditemukan.");
  return opname;
}

export async function rejectOpname(
  context: RequestContext,
  id: string,
): Promise<StockOpnameView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const client = await getSqlClient();
  await client.begin(async (transaction) => {
    const [opname] = await transaction`
      select id, status from stock_opnames where id = ${id} for update`;
    if (!opname) throw notFound("Opname tidak ditemukan.");
    if (opname.status === "REJECTED") return;
    if (opname.status !== "PENDING") throw conflict("Opname sudah disetujui.");
    await transaction`
      update stock_opnames
      set
        status = 'REJECTED',
        reviewed_by = ${context.user!.id},
        reviewed_at = now(),
        updated_at = now()
      where id = ${id}`;
  });
  const opname = await getOpname(id);
  if (!opname) throw notFound("Opname tidak ditemukan.");
  return opname;
}

export async function getOpname(id: string): Promise<StockOpnameView | null> {
  const client = await getSqlClient();
  const [row] = await client`
    select
      id, opname_no, location, status, created_by, reviewed_by, reviewed_at,
      submitted_at, created_at, updated_at
    from stock_opnames
    where id = ${id}
    limit 1`;
  if (!row) return null;
  return buildOpname(row);
}

async function buildOpname(
  row: Record<string, unknown>,
): Promise<StockOpnameView> {
  const client = await getSqlClient();
  const itemRows = (await client`
    select id, product_id, system_qty, physical_qty, diff_qty
    from stock_opname_items
    where opname_id = ${row.id as string}
    order by id`) as Array<{
    id: string;
    product_id: string;
    system_qty: string;
    physical_qty: string;
    diff_qty: string;
  }>;
  const products = await loadProductsByIds([
    ...new Set(itemRows.map((item) => item.product_id)),
  ]);
  const items: StockOpnameItemView[] = [];
  for (const item of itemRows) {
    const product = products.get(item.product_id);
    if (!product) continue;
    items.push({
      id: item.id,
      productId: item.product_id,
      product,
      systemQty: decimal(item.system_qty),
      physicalQty: decimal(item.physical_qty),
      diffQty: decimal(item.diff_qty),
    });
  }

  const users = await loadUsers([
    row.created_by as string,
    row.reviewed_by as string | null,
  ]);
  const createdBy = users.get(row.created_by as string);
  if (!createdBy) throw notFound("Pembuat opname tidak ditemukan.");

  return {
    id: row.id as string,
    opnameNo: row.opname_no as string,
    location: row.location as "WAREHOUSE" | "STORE",
    status: row.status as StockOpnameView["status"],
    createdBy,
    reviewedBy: row.reviewed_by
      ? (users.get(row.reviewed_by as string) ?? null)
      : null,
    reviewedAt: row.reviewed_at as Date | null,
    submittedAt: row.submitted_at as Date | null,
    items,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function listOpnames(input: {
  filter?: {
    search?: string | null;
    status?: string | null;
    location?: string | null;
    range?: { from?: Date | null; to?: Date | null } | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<OpnamePageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      opnameNo: "o.opname_no",
      createdAt: "o.created_at",
      updatedAt: "o.updated_at",
      status: "o.status",
    },
    "o.created_at",
  );
  const search = input.filter?.search ? `%${input.filter.search}%` : null;
  const status = input.filter?.status ?? null;
  const location = input.filter?.location ?? null;
  const from = toDate(input.filter?.range?.from)?.toISOString() ?? null;
  const to = toDate(input.filter?.range?.to)?.toISOString() ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from stock_opnames o
    where (${search}::text is null or o.opname_no ilike ${search})
      and (${status}::text is null or o.status::text = ${status})
      and (${location}::text is null or o.location::text = ${location})
      and (${from}::timestamptz is null or o.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or o.created_at <= ${to}::timestamptz)`;

  const rows = await client`
    select
      id, opname_no, location, status, created_by, reviewed_by, reviewed_at,
      submitted_at, created_at, updated_at
    from stock_opnames o
    where (${search}::text is null or o.opname_no ilike ${search})
      and (${status}::text is null or o.status::text = ${status})
      and (${location}::text is null or o.location::text = ${location})
      and (${from}::timestamptz is null or o.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or o.created_at <= ${to}::timestamptz)
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`;

  return {
    items: await Promise.all(
      rows.map((row: Record<string, unknown>) => buildOpname(row)),
    ),
    pageInfo: pageInfo(page, Number(countRow.total)),
  };
}

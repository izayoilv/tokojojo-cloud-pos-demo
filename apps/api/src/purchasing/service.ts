import { findUserById } from "../auth/repository.ts";
import { userRowToContextUser } from "../auth/user-mapper.ts";
import {
  getProduct,
  getSupplier,
  loadProductsByIds,
} from "../catalog/service.ts";
import {
  type DbClient,
  decimal,
  documentNumber,
  getSqlClient,
  isUniqueViolation,
  money,
  normalizePage,
  type PageInfo,
  pageInfo,
  resolveSort,
  toDate,
  toMoney,
  toQuantity,
} from "../db/query.ts";
import type { RequestContext } from "../graphql/context.ts";
import { conflict, notFound, validationFailed } from "../graphql/errors.ts";

export interface PurchaseItemView {
  id: string;
  productId: string;
  productUnitId: string;
  product: Awaited<ReturnType<typeof getProduct>>;
  unit: NonNullable<Awaited<ReturnType<typeof getProduct>>>["units"][number];
  productName: string;
  unitName: string;
  qty: string;
  qtyBase: string;
  unitCost: string;
  subtotal: string;
}

export interface PurchasePaymentView {
  id: string;
  amount: string;
  paymentMethod: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
  reference: string | null;
  paidAt: Date | string;
  createdBy: ReturnType<typeof userRowToContextUser>;
}

export interface PurchaseView {
  id: string;
  purchaseNo: string;
  supplierId: string;
  supplier: Awaited<ReturnType<typeof getSupplier>>;
  supplierName: string;
  createdBy: ReturnType<typeof userRowToContextUser>;
  supplierInvoiceNo: string | null;
  dueDate: string | null;
  totalAmount: string;
  paid: string;
  outstanding: string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  receivedAt: Date | string;
  status: "OPEN" | "CANCELLED";
  items: PurchaseItemView[];
  payments: PurchasePaymentView[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PayableView {
  purchase: PurchaseView;
  purchaseNo: string;
  supplier: NonNullable<Awaited<ReturnType<typeof getSupplier>>>;
  supplierInvoiceNo: string | null;
  dueDate: string | null;
  totalAmount: string;
  paid: string;
  outstanding: string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
}

export interface PurchasePageView {
  items: PurchaseView[];
  pageInfo: PageInfo;
}

export interface PayablePageView {
  items: PayableView[];
  pageInfo: PageInfo;
}

interface PurchaseRow {
  id: string;
  purchase_no: string;
  supplier_id: string;
  supplier_name: string;
  created_by: string;
  supplier_invoice_no: string | null;
  due_date: string | null;
  total_amount: string;
  paid: string | null;
  outstanding: string | null;
  payment_status: string | null;
  received_at: Date;
  status: "OPEN" | "CANCELLED";
  created_at: Date;
  updated_at: Date;
}

interface PurchaseItemRow {
  id: string;
  product_id: string;
  product_unit_id: string;
  product_name: string;
  unit_name: string;
  qty: string;
  qty_base: string;
  unit_cost: string;
  subtotal: string;
}

interface PurchasePaymentRow {
  id: string;
  amount: string;
  payment_method: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
  reference: string | null;
  paid_at: Date;
  created_by: string;
}

async function buildPurchase(row: PurchaseRow): Promise<PurchaseView | null> {
  const [supplier, creator] = await Promise.all([
    getSupplier(row.supplier_id),
    findUserById(row.created_by),
  ]);
  if (!supplier || !creator) return null;

  const client = await getSqlClient();
  const itemRows = (await client`
    select
      id, product_id, product_unit_id, product_name, unit_name,
      qty, qty_base, unit_cost, subtotal
    from purchase_items
    where purchase_id = ${row.id}
    order by id`) as PurchaseItemRow[];

  const productMap = await loadProductsByIds([
    ...new Set(itemRows.map((item) => item.product_id)),
  ]);
  const items: PurchaseItemView[] = [];
  for (const item of itemRows) {
    const product = productMap.get(item.product_id);
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
      productName: item.product_name,
      unitName: item.unit_name,
      qty: decimal(item.qty),
      qtyBase: decimal(item.qty_base),
      unitCost: money(item.unit_cost),
      subtotal: money(item.subtotal),
    });
  }

  const paymentRows = (await client`
    select id, amount, payment_method, reference, paid_at, created_by
    from purchase_payments
    where purchase_id = ${row.id}
    order by paid_at, id`) as PurchasePaymentRow[];

  const paymentUsers = new Map(
    await Promise.all(
      [...new Set(paymentRows.map((payment) => payment.created_by))].map(
        async (id) => [id, await findUserById(id)] as const,
      ),
    ),
  );

  const payments: PurchasePaymentView[] = [];
  for (const payment of paymentRows) {
    const user = paymentUsers.get(payment.created_by);
    if (!user) continue;
    payments.push({
      id: payment.id,
      amount: money(payment.amount),
      paymentMethod: payment.payment_method,
      reference: payment.reference,
      paidAt: payment.paid_at,
      createdBy: userRowToContextUser(user, null),
    });
  }

  const paid = money(row.paid);
  const outstanding = money(
    row.outstanding ?? Math.max(Number(row.total_amount) - Number(paid), 0),
  );
  const paymentStatus =
    (row.payment_status as "PAID" | "PARTIAL" | "UNPAID" | null) ??
    (Number(paid) >= Number(row.total_amount)
      ? "PAID"
      : Number(paid) > 0
        ? "PARTIAL"
        : "UNPAID");

  return {
    id: row.id,
    purchaseNo: row.purchase_no,
    supplierId: row.supplier_id,
    supplier,
    supplierName: row.supplier_name,
    createdBy: userRowToContextUser(creator, null),
    supplierInvoiceNo: row.supplier_invoice_no,
    dueDate: row.due_date,
    totalAmount: money(row.total_amount),
    paid,
    outstanding,
    paymentStatus,
    receivedAt: row.received_at,
    status: row.status,
    items,
    payments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPurchase(id: string): Promise<PurchaseView | null> {
  const client = await getSqlClient();
  const [row] = (await client`
    select
      p.id, p.purchase_no, p.supplier_id, p.supplier_name, p.created_by,
      p.supplier_invoice_no, p.due_date::text as due_date,
      p.total_amount, p.received_at, p.status, p.created_at, p.updated_at,
      b.paid, b.outstanding, b.payment_status
    from purchases p
    left join v_purchase_balances b on b.purchase_id = p.id
    where p.id = ${id}
    limit 1`) as PurchaseRow[];
  return row ? buildPurchase(row) : null;
}

export async function listPurchases(input: {
  filter?: {
    search?: string | null;
    supplierId?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
    range?: { from?: Date | null; to?: Date | null } | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<PurchasePageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      purchaseNo: "p.purchase_no",
      supplierName: "p.supplier_name",
      receivedAt: "p.received_at",
      createdAt: "p.created_at",
      totalAmount: "p.total_amount",
    },
    "p.created_at",
  );
  const search = input.filter?.search ? `%${input.filter.search}%` : null;
  const supplierId = input.filter?.supplierId ?? null;
  const status = input.filter?.status ?? null;
  const paymentStatus = input.filter?.paymentStatus ?? null;
  const from = toDate(input.filter?.range?.from)?.toISOString() ?? null;
  const to = toDate(input.filter?.range?.to)?.toISOString() ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from purchases p
    left join v_purchase_balances b on b.purchase_id = p.id
    where     (${search}::text is null
      or p.purchase_no ilike ${search}
      or p.supplier_name ilike ${search}
      or p.supplier_invoice_no ilike ${search})
    and (${supplierId}::uuid is null or p.supplier_id = ${supplierId}::uuid)
    and (${status}::text is null or p.status::text = ${status})
    and (${paymentStatus}::text is null or b.payment_status = ${paymentStatus})
    and (${from}::timestamptz is null or p.received_at >= ${from}::timestamptz)
    and (${to}::timestamptz is null or p.received_at <= ${to}::timestamptz)`;

  const rows = (await client`
    select
      p.id, p.purchase_no, p.supplier_id, p.supplier_name, p.created_by,
      p.supplier_invoice_no, p.due_date::text as due_date,
      p.total_amount, p.received_at, p.status, p.created_at, p.updated_at,
      b.paid, b.outstanding, b.payment_status
    from purchases p
    left join v_purchase_balances b on b.purchase_id = p.id
    where     (${search}::text is null
      or p.purchase_no ilike ${search}
      or p.supplier_name ilike ${search}
      or p.supplier_invoice_no ilike ${search})
    and (${supplierId}::uuid is null or p.supplier_id = ${supplierId}::uuid)
    and (${status}::text is null or p.status::text = ${status})
    and (${paymentStatus}::text is null or b.payment_status = ${paymentStatus})
    and (${from}::timestamptz is null or p.received_at >= ${from}::timestamptz)
    and (${to}::timestamptz is null or p.received_at <= ${to}::timestamptz)
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`) as PurchaseRow[];

  const items: PurchaseView[] = [];
  for (const row of rows) {
    const purchase = await buildPurchase(row);
    if (purchase) items.push(purchase);
  }

  return { items, pageInfo: pageInfo(page, Number(countRow.total)) };
}

interface PurchaseLineInput {
  productId: string;
  productUnitId: string;
  qty: string;
  unitCost: string;
}

interface PreparedPurchaseLine extends PurchaseLineInput {
  productName: string;
  unitName: string;
  qtyBase: string;
  subtotal: string;
  conversionQty: string;
}

async function preparePurchaseLines(
  client: DbClient,
  items: PurchaseLineInput[],
): Promise<PreparedPurchaseLine[]> {
  if (items.length === 0) throw validationFailed("Item pembelian wajib diisi.");

  const productIds = [...new Set(items.map((item) => item.productId))].sort();
  const locked = await client`
    select id from products where id = any(${productIds}::uuid[])
    order by id for update`;
  if (locked.length !== productIds.length) {
    throw notFound("Produk tidak ditemukan.");
  }

  const units = await client`
    select
      pu.id, pu.product_id, pu.unit_name, pu.conversion_qty,
      p.name as product_name
    from product_units pu
    join products p on p.id = pu.product_id
    where pu.product_id = any(${productIds}::uuid[])`;

  const unitMap = new Map(
    units.map((unit: Record<string, unknown>) => [unit.id, unit]),
  );
  return items.map((item) => {
    const unit = unitMap.get(item.productUnitId) as
      | {
          product_id: string;
          unit_name: string;
          conversion_qty: string;
          product_name: string;
        }
      | undefined;
    if (!unit || unit.product_id !== item.productId) {
      throw validationFailed("productUnitId tidak sesuai dengan produk.");
    }

    const qty = Number(item.qty);
    const unitCost = Number(item.unitCost);
    if (!(qty > 0)) throw validationFailed("qty harus lebih dari 0.");
    if (!Number.isInteger(unitCost) || unitCost < 0) {
      throw validationFailed("unitCost harus rupiah bulat non-negatif.");
    }

    return {
      ...item,
      productName: unit.product_name,
      unitName: unit.unit_name,
      qtyBase: toQuantity(qty * Number(unit.conversion_qty)),
      subtotal: String(toMoney(qty * unitCost)),
      conversionQty: decimal(unit.conversion_qty),
    };
  });
}

async function defaultLocation(
  client: DbClient,
): Promise<"WAREHOUSE" | "STORE"> {
  const [settings] = await client`
    select default_location from store_settings where id = true limit 1`;
  return settings?.default_location ?? "STORE";
}

export interface CreatePurchaseOptions {
  location?: "WAREHOUSE" | "STORE" | null;
  notes?: string | null;
}

function assertDueDate(value: string | null | undefined): void {
  if (value === undefined || value === null || value === "") return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw validationFailed("dueDate harus format YYYY-MM-DD.");
  }
}

export async function createPurchaseRecord(
  client: DbClient,
  context: RequestContext,
  input: {
    supplierId: string;
    supplierInvoiceNo?: string | null;
    dueDate?: string | null;
    items: PurchaseLineInput[];
  },
  options: CreatePurchaseOptions = {},
): Promise<string> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  assertDueDate(input.dueDate);
  const supplier = await getSupplier(input.supplierId);
  if (!supplier) throw notFound("Supplier tidak ditemukan.");

  const lines = await preparePurchaseLines(client, input.items);
  const total = lines.reduce((sum, line) => sum + Number(line.subtotal), 0);
  const location = options.location ?? (await defaultLocation(client));

  const [purchase] = await client`
    insert into purchases (
      purchase_no, supplier_id, supplier_name, created_by,
      supplier_invoice_no, due_date, total_amount, status
    )
    values (
      ${documentNumber("PO")}, ${input.supplierId}, ${supplier.name},
      ${context.user.id}, ${input.supplierInvoiceNo ?? null},
      ${input.dueDate ?? null}, ${toMoney(total)}, 'OPEN'
    )
    returning id`;

  const productIds = [...new Set(lines.map((line) => line.productId))];
  const oldBalances = (await client`
    select product_id, coalesce(sum(qty_change), 0)::numeric(12,3) as qty
    from stock_movements
    where product_id = any(${productIds}::uuid[])
    group by product_id`) as Array<{ product_id: string; qty: string }>;
  const oldQtyMap = new Map(
    oldBalances.map((row) => [row.product_id, Number(row.qty)]),
  );
  const locationBalances = (await client`
    select product_id, coalesce(sum(qty_change), 0)::numeric(12,3) as qty
    from stock_movements
    where product_id = any(${productIds}::uuid[]) and location = ${location}
    group by product_id`) as Array<{ product_id: string; qty: string }>;
  const locationQtyMap = new Map(
    locationBalances.map((row) => [row.product_id, Number(row.qty)]),
  );

  const receivedByProduct = new Map<string, { qty: number; value: number }>();
  for (const line of lines) {
    await client`
      insert into purchase_items (
        purchase_id, product_id, product_unit_id, product_name, unit_name,
        qty, qty_base, unit_cost, subtotal
      )
      values (
        ${purchase.id}, ${line.productId}, ${line.productUnitId},
        ${line.productName}, ${line.unitName}, ${line.qty}, ${line.qtyBase},
        ${Number(line.unitCost)}, ${Number(line.subtotal)}
      )
    `;

    const current =
      (locationQtyMap.get(line.productId) ?? 0) + Number(line.qtyBase);
    locationQtyMap.set(line.productId, current);

    await client`
      insert into stock_movements (
        product_id, location, qty_change, movement_type, reference_type,
        reference_id, notes, flagged, flag_reason, created_by
      )
      values (
        ${line.productId}, ${location}, ${line.qtyBase}, 'PURCHASE',
        'PURCHASE', ${purchase.id}, ${options.notes ?? null},
        ${current < 0}, ${current < 0 ? "NEGATIVE_STOCK" : null},
        ${context.user.id}
      )`;

    const received = receivedByProduct.get(line.productId) ?? {
      qty: 0,
      value: 0,
    };
    received.qty += Number(line.qtyBase);
    received.value += Number(line.subtotal);
    receivedByProduct.set(line.productId, received);
  }

  const products = (await client`
    select id, avg_cost from products where id = any(${productIds}::uuid[])`) as Array<{
    id: string;
    avg_cost: string;
  }>;
  const avgMap = new Map(products.map((row) => [row.id, Number(row.avg_cost)]));
  for (const [productId, received] of receivedByProduct) {
    const oldQty = oldQtyMap.get(productId) ?? 0;
    const oldCost = avgMap.get(productId) ?? 0;
    const denominator = oldQty + received.qty;
    const newCost =
      denominator > 0
        ? Math.max(
            0,
            Math.round((oldCost * oldQty + received.value) / denominator),
          )
        : 0;
    await client`
      update products
      set avg_cost = ${newCost}, updated_at = now()
      where id = ${productId}`;
  }

  return purchase.id as string;
}

export async function createPurchase(
  context: RequestContext,
  input: {
    supplierId: string;
    supplierInvoiceNo?: string | null;
    dueDate?: string | null;
    items: PurchaseLineInput[];
  },
): Promise<PurchaseView> {
  const client = await getSqlClient();
  const purchaseId = await client.begin((transaction) =>
    createPurchaseRecord(transaction, context, input),
  );
  const purchase = await getPurchase(purchaseId);
  if (!purchase) throw notFound("Pembelian tidak ditemukan.");
  return purchase;
}

export async function cancelPurchase(
  context: RequestContext,
  id: string,
): Promise<PurchaseView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const userId = context.user.id;
  const client = await getSqlClient();

  await client.begin(async (transaction) => {
    const [purchase] = await transaction`
      select id, status from purchases where id = ${id} for update`;
    if (!purchase) throw notFound("Pembelian tidak ditemukan.");
    if (purchase.status === "CANCELLED") return;
    if (purchase.status !== "OPEN")
      throw conflict("Pembelian tidak bisa dibatalkan.");

    const movements = (await transaction`
      select product_id, location, qty_change
      from stock_movements
      where reference_type = 'PURCHASE' and reference_id = ${id}
        and movement_type = 'PURCHASE'`) as Array<{
      product_id: string;
      location: "WAREHOUSE" | "STORE";
      qty_change: string;
    }>;

    const productIds = [
      ...new Set(movements.map((row) => row.product_id)),
    ].sort();
    if (productIds.length > 0) {
      await transaction`
        select id from products where id = any(${productIds}::uuid[])
        order by id for update`;
    }

    for (const movement of movements) {
      const [balance] = await transaction`
        select coalesce(sum(qty_change), 0)::numeric(12,3) as qty
        from stock_movements
        where product_id = ${movement.product_id}
          and location = ${movement.location}`;
      const next = Number(balance.qty) - Number(movement.qty_change);
      await transaction`
        insert into stock_movements (
          product_id, location, qty_change, movement_type, reference_type,
          reference_id, flagged, flag_reason, created_by
        )
        values (
          ${movement.product_id}, ${movement.location}, ${-Number(movement.qty_change)},
          'PURCHASE_CANCEL', 'PURCHASE', ${id}, ${next < 0},
          ${next < 0 ? "NEGATIVE_STOCK" : null}, ${userId}
        )`;
    }

    await transaction`
      update purchases
      set status = 'CANCELLED', updated_at = now()
      where id = ${id}`;
  });

  const purchase = await getPurchase(id);
  if (!purchase) throw notFound("Pembelian tidak ditemukan.");
  return purchase;
}

export async function addPurchasePayment(
  context: RequestContext,
  input: {
    purchaseId: string;
    amount: string;
    paymentMethod: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
    reference?: string | null;
    paidAt?: Date | null;
  },
): Promise<PurchaseView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const userId = context.user.id;
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw validationFailed("amount harus rupiah bulat lebih dari 0.");
  }

  const client = await getSqlClient();
  try {
    await client.begin(async (transaction) => {
      const [purchase] = await transaction`
        select id, status from purchases where id = ${input.purchaseId} for update`;
      if (!purchase) throw notFound("Pembelian tidak ditemukan.");
      if (purchase.status !== "OPEN")
        throw conflict("Pembelian sudah ditutup.");

      const paidAt = input.paidAt ?? new Date();
      const [payment] = await transaction`
        insert into purchase_payments (
          purchase_id, amount, payment_method, reference, paid_at, created_by
        )
        values (
          ${input.purchaseId}, ${amount}, ${input.paymentMethod},
          ${input.reference ?? null}, ${paidAt.toISOString()}::timestamptz,
          ${userId}
        )
        returning id`;

      await transaction`
        insert into cash_flows (
          type, payment_method, category, amount, reference_type,
          reference_id, source, notes, created_by
        )
        values (
          'OUT', ${input.paymentMethod}, 'PURCHASE', ${amount},
          'PURCHASE_PAYMENT', ${payment.id}, 'AUTO', ${input.reference ?? null},
          ${userId}
        )`;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Pembayaran ini sudah tercatat.");
    }
    throw error;
  }

  const purchase = await getPurchase(input.purchaseId);
  if (!purchase) throw notFound("Pembelian tidak ditemukan.");
  return purchase;
}

export async function listPayables(input: {
  filter?: {
    search?: string | null;
    supplierId?: string | null;
    paymentStatus?: string | null;
    dueBefore?: string | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<PayablePageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      dueDate: "p.due_date",
      totalAmount: "p.total_amount",
      outstanding: "b.outstanding",
      supplierName: "p.supplier_name",
    },
    "p.due_date",
  );
  const search = input.filter?.search ? `%${input.filter.search}%` : null;
  const supplierId = input.filter?.supplierId ?? null;
  const paymentStatus = input.filter?.paymentStatus ?? null;
  const dueBefore = input.filter?.dueBefore ?? null;
  assertDueDate(dueBefore);
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from purchases p
    join v_purchase_balances b on b.purchase_id = p.id
    where p.status = 'OPEN'
      and (${search}::text is null
        or p.purchase_no ilike ${search}
        or p.supplier_name ilike ${search}
        or p.supplier_invoice_no ilike ${search})
      and (${supplierId}::uuid is null or p.supplier_id = ${supplierId}::uuid)
      and (${paymentStatus}::text is null or b.payment_status = ${paymentStatus})
      and (${dueBefore}::date is null or p.due_date < ${dueBefore}::date)`;

  const rows = (await client`
    select
      p.id, p.purchase_no, p.supplier_id, p.supplier_name, p.created_by,
      p.supplier_invoice_no, p.due_date::text as due_date,
      p.total_amount, p.received_at, p.status, p.created_at, p.updated_at,
      b.paid, b.outstanding, b.payment_status
    from purchases p
    join v_purchase_balances b on b.purchase_id = p.id
    where p.status = 'OPEN'
      and (${search}::text is null
        or p.purchase_no ilike ${search}
        or p.supplier_name ilike ${search}
        or p.supplier_invoice_no ilike ${search})
      and (${supplierId}::uuid is null or p.supplier_id = ${supplierId}::uuid)
      and (${paymentStatus}::text is null or b.payment_status = ${paymentStatus})
      and (${dueBefore}::date is null or p.due_date < ${dueBefore}::date)
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`) as PurchaseRow[];

  const items: PayableView[] = [];
  for (const row of rows) {
    const purchase = await buildPurchase(row);
    if (!purchase || !purchase.supplier) continue;
    items.push({
      purchase,
      purchaseNo: purchase.purchaseNo,
      supplier: purchase.supplier,
      supplierInvoiceNo: purchase.supplierInvoiceNo,
      dueDate: purchase.dueDate,
      totalAmount: purchase.totalAmount,
      paid: purchase.paid,
      outstanding: purchase.outstanding,
      paymentStatus: purchase.paymentStatus,
    });
  }

  return { items, pageInfo: pageInfo(page, Number(countRow.total)) };
}

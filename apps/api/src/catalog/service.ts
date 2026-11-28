import {
  type DbClient,
  decimal,
  getSqlClient,
  isForeignKeyViolation,
  isUniqueViolation,
  money,
  normalizePage,
  type PageInfo,
  pageInfo,
  resolveSort,
} from "../db/query.ts";
import { conflict, notFound, validationFailed } from "../graphql/errors.ts";

export interface CategoryView {
  id: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ProductUnitView {
  id: string;
  productId: string;
  unitName: string;
  conversionQty: string;
  sellingPrice: string;
  barcode: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ProductStockThresholdView {
  productId: string;
  location: "WAREHOUSE" | "STORE";
  minQty: string;
}

export interface ProductView {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category: CategoryView;
  baseUnit: string;
  avgCost: string;
  isActive: boolean;
  units: ProductUnitView[];
  thresholds: ProductStockThresholdView[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SupplierView {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CustomerView {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  outstandingReceivable: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CatalogSyncView {
  serverTime: Date;
  products: ProductView[];
  categories: CategoryView[];
  suppliers: SupplierView[];
  tombstones: Array<{
    entityType: "PRODUCT" | "CATEGORY" | "SUPPLIER";
    entityId: string;
    deletedAt: Date | string;
  }>;
}

export interface ProductPageView {
  items: ProductView[];
  pageInfo: PageInfo;
}

export interface SupplierPageView {
  items: SupplierView[];
  pageInfo: PageInfo;
}

export interface CustomerPageView {
  items: CustomerView[];
  pageInfo: PageInfo;
}

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  category_name: string;
  category_created_at: Date;
  category_updated_at: Date;
  base_unit: string;
  avg_cost: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function categoryFromRow(row: {
  category_id: string;
  category_name: string;
  category_created_at: Date;
  category_updated_at: Date;
}): CategoryView {
  return {
    id: row.category_id,
    name: row.category_name,
    createdAt: row.category_created_at,
    updatedAt: row.category_updated_at,
  };
}

function productFromRow(
  row: ProductRow,
  units: ProductUnitView[],
  thresholds: ProductStockThresholdView[],
): ProductView {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    categoryId: row.category_id,
    category: categoryFromRow(row),
    baseUnit: row.base_unit,
    avgCost: money(row.avg_cost),
    isActive: row.is_active,
    units,
    thresholds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadUnits(
  client: DbClient,
  productIds: string[],
): Promise<Map<string, ProductUnitView[]>> {
  const result = new Map<string, ProductUnitView[]>();
  if (productIds.length === 0) return result;

  const rows = await client`
    select
      id, product_id, unit_name, conversion_qty, selling_price, barcode,
      created_at, updated_at
    from product_units
    where product_id = any(${productIds}::uuid[])
    order by conversion_qty, unit_name, id`;

  for (const row of rows) {
    const list = result.get(row.product_id) ?? [];
    list.push({
      id: row.id,
      productId: row.product_id,
      unitName: row.unit_name,
      conversionQty: decimal(row.conversion_qty),
      sellingPrice: money(row.selling_price),
      barcode: row.barcode,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    result.set(row.product_id, list);
  }
  return result;
}

async function loadThresholds(
  client: DbClient,
  productIds: string[],
): Promise<Map<string, ProductStockThresholdView[]>> {
  const result = new Map<string, ProductStockThresholdView[]>();
  if (productIds.length === 0) return result;

  const rows = await client`
    select product_id, location, min_qty
    from product_stock_thresholds
    where product_id = any(${productIds}::uuid[])
    order by location`;

  for (const row of rows) {
    const list = result.get(row.product_id) ?? [];
    list.push({
      productId: row.product_id,
      location: row.location,
      minQty: decimal(row.min_qty),
    });
    result.set(row.product_id, list);
  }
  return result;
}

async function hydrateProducts(
  client: DbClient,
  rows: ProductRow[],
): Promise<ProductView[]> {
  const ids = rows.map((row) => row.id);
  const [units, thresholds] = await Promise.all([
    loadUnits(client, ids),
    loadThresholds(client, ids),
  ]);

  return rows.map((row) =>
    productFromRow(row, units.get(row.id) ?? [], thresholds.get(row.id) ?? []),
  );
}

export async function listProducts(input: {
  filter?: {
    search?: string | null;
    barcode?: string | null;
    categoryId?: string | null;
    isActive?: boolean | null;
    location?: string | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<ProductPageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      name: "p.name",
      sku: "p.sku",
      createdAt: "p.created_at",
      updatedAt: "p.updated_at",
      avgCost: "p.avg_cost",
    },
    "p.created_at",
  );
  const search = input.filter?.search ? `%${input.filter.search}%` : null;
  const barcode = input.filter?.barcode ?? null;
  const categoryId = input.filter?.categoryId ?? null;
  const isActive = input.filter?.isActive ?? null;
  const location = input.filter?.location ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from products p
    where (${search}::text is null
        or p.name ilike ${search} or p.sku ilike ${search})
      and (${barcode}::text is null or exists (
        select 1 from product_units pu
        where pu.product_id = p.id and pu.barcode = ${barcode}
      ))
      and (${categoryId}::uuid is null or p.category_id = ${categoryId}::uuid)
      and (${isActive}::boolean is null or p.is_active = ${isActive})
      and (${location}::text is null or exists (
        select 1 from stock_movements sm
        where sm.product_id = p.id and sm.location::text = ${location}
      ))`;

  const rows = (await client`
    select p.id, p.sku, p.name, p.category_id, p.base_unit, p.avg_cost,
      p.is_active, p.created_at, p.updated_at,
      c.name as category_name,
      c.created_at as category_created_at,
      c.updated_at as category_updated_at
    from products p
    join categories c on c.id = p.category_id
    where (${search}::text is null
        or p.name ilike ${search} or p.sku ilike ${search})
      and (${barcode}::text is null or exists (
        select 1 from product_units pu
        where pu.product_id = p.id and pu.barcode = ${barcode}
      ))
      and (${categoryId}::uuid is null or p.category_id = ${categoryId}::uuid)
      and (${isActive}::boolean is null or p.is_active = ${isActive})
      and (${location}::text is null or exists (
        select 1 from stock_movements sm
        where sm.product_id = p.id and sm.location::text = ${location}
      ))
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`) as ProductRow[];

  return {
    items: await hydrateProducts(client, rows),
    pageInfo: pageInfo(page, Number(countRow.total)),
  };
}

export async function getProduct(id: string): Promise<ProductView | null> {
  const client = await getSqlClient();
  const [row] = await client`
    select p.id, p.sku, p.name, p.category_id, p.base_unit, p.avg_cost,
      p.is_active, p.created_at, p.updated_at,
      c.name as category_name,
      c.created_at as category_created_at,
      c.updated_at as category_updated_at
    from products p
    join categories c on c.id = p.category_id
    where p.id = ${id}
    limit 1`;
  if (!row) return null;
  return (await hydrateProducts(client, [row as ProductRow]))[0] ?? null;
}

export async function loadProductsByIds(
  ids: string[],
): Promise<Map<string, ProductView>> {
  const result = new Map<string, ProductView>();
  if (ids.length === 0) return result;
  const client = await getSqlClient();
  const rows = (await client`
    select p.id, p.sku, p.name, p.category_id, p.base_unit, p.avg_cost,
      p.is_active, p.created_at, p.updated_at,
      c.name as category_name,
      c.created_at as category_created_at,
      c.updated_at as category_updated_at
    from products p
    join categories c on c.id = p.category_id
    where p.id = any(${ids}::uuid[])`) as ProductRow[];
  for (const product of await hydrateProducts(client, rows)) {
    result.set(product.id, product);
  }
  return result;
}

function assertNonBlank(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw validationFailed(`${label} wajib diisi.`);
  return trimmed;
}

function assertBaseUnitCount(units: Array<{ conversionQty: string }>): void {
  const baseUnits = units.filter(
    (unit) => Math.abs(Number(unit.conversionQty) - 1) < 0.0005,
  );
  if (baseUnits.length !== 1) {
    throw validationFailed(
      "Produk harus memiliki tepat satu unit dasar dengan conversionQty = 1.",
    );
  }
}

function assertThresholds(
  thresholds: Array<{ location: string; minQty: string }> | null | undefined,
): void {
  for (const threshold of thresholds ?? []) {
    if (!(Number(threshold.minQty) >= 0)) {
      throw validationFailed("minQty harus non-negatif.");
    }
  }
}

function assertUnitInputs(
  units: Array<{
    unitName: string;
    conversionQty: string;
    sellingPrice: string;
  }>,
): void {
  for (const unit of units) {
    assertNonBlank(unit.unitName, "Nama unit");
    if (!(Number(unit.conversionQty) > 0)) {
      throw validationFailed("conversionQty harus lebih dari 0.");
    }
    if (
      !Number.isInteger(Number(unit.sellingPrice)) ||
      Number(unit.sellingPrice) < 0
    ) {
      throw validationFailed("sellingPrice harus rupiah bulat non-negatif.");
    }
  }
}

export async function createProduct(input: {
  sku: string;
  name: string;
  categoryId: string;
  baseUnit: string;
  units: Array<{
    productUnitId?: string | null;
    unitName: string;
    conversionQty: string;
    sellingPrice: string;
    barcode?: string | null;
  }>;
  thresholds?: Array<{ location: string; minQty: string }> | null;
}): Promise<ProductView> {
  if (input.units.length === 0) throw validationFailed("Unit wajib diisi.");
  assertUnitInputs(input.units);
  assertBaseUnitCount(input.units);
  assertThresholds(input.thresholds);

  const client = await getSqlClient();
  let productId: string;
  try {
    productId = await client.begin(async (transaction) => {
      const [product] = await transaction`
        insert into products (sku, name, category_id, base_unit)
        values (
          ${assertNonBlank(input.sku, "SKU")},
          ${assertNonBlank(input.name, "Nama produk")},
          ${input.categoryId},
          ${assertNonBlank(input.baseUnit, "Base unit")}
        )
        returning id`;

      for (const unit of input.units) {
        await transaction`
          insert into product_units (
            product_id, unit_name, conversion_qty, selling_price, barcode
          )
          values (
            ${product.id}, ${unit.unitName.trim()}, ${unit.conversionQty},
            ${Number(unit.sellingPrice)}, ${unit.barcode ?? null}
          )`;
      }

      for (const threshold of input.thresholds ?? []) {
        await transaction`
          insert into product_stock_thresholds (product_id, location, min_qty)
          values (${product.id}, ${threshold.location}, ${threshold.minQty})
          on conflict (product_id, location) do update
          set min_qty = excluded.min_qty, updated_at = now()`;
      }

      return product.id as string;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("SKU, nama unit, atau barcode sudah dipakai.");
    }
    if (isForeignKeyViolation(error)) {
      throw notFound("Kategori tidak ditemukan.");
    }
    throw error;
  }

  const product = await getProduct(productId);
  if (!product) throw notFound("Produk tidak ditemukan.");
  return product;
}

export async function updateProduct(
  id: string,
  input: {
    name?: string | null;
    categoryId?: string | null;
    baseUnit?: string | null;
    units?: Array<{
      productUnitId?: string | null;
      unitName: string;
      conversionQty: string;
      sellingPrice: string;
      barcode?: string | null;
    }> | null;
    thresholds?: Array<{ location: string; minQty: string }> | null;
  },
): Promise<ProductView> {
  const client = await getSqlClient();
  const existing = await getProduct(id);
  if (!existing) throw notFound("Produk tidak ditemukan.");
  if (input.name !== undefined && input.name !== null && !input.name.trim()) {
    throw validationFailed("Nama produk wajib diisi.");
  }
  if (
    input.baseUnit !== undefined &&
    input.baseUnit !== null &&
    !input.baseUnit.trim()
  ) {
    throw validationFailed("Base unit wajib diisi.");
  }

  if (input.units) {
    assertUnitInputs(input.units);
    const currentUnits = (await client`
      select id, conversion_qty from product_units where product_id = ${id}`) as Array<{
      id: string;
      conversion_qty: string;
    }>;
    const conversions = new Map<string, number>(
      currentUnits.map((unit) => [unit.id, Number(unit.conversion_qty)]),
    );
    const added: number[] = [];
    for (const unit of input.units) {
      if (unit.productUnitId) {
        conversions.set(unit.productUnitId, Number(unit.conversionQty));
      } else {
        added.push(Number(unit.conversionQty));
      }
    }
    const baseCount = [...conversions.values(), ...added].filter(
      (conversion) => Math.abs(conversion - 1) < 0.0005,
    ).length;
    if (baseCount !== 1) {
      throw validationFailed(
        "Produk harus memiliki tepat satu unit dasar dengan conversionQty = 1.",
      );
    }
  }
  assertThresholds(input.thresholds);

  try {
    await client.begin(async (transaction) => {
      await transaction`
        update products
        set
          name = coalesce(${input.name?.trim() ?? null}, name),
          category_id = coalesce(${input.categoryId ?? null}::uuid, category_id),
          base_unit = coalesce(${input.baseUnit?.trim() ?? null}, base_unit),
          updated_at = now()
        where id = ${id}`;

      if (input.units) {
        for (const unit of input.units) {
          if (unit.productUnitId) {
            const updated = await transaction`
              update product_units
              set
                unit_name = ${unit.unitName.trim()},
                conversion_qty = ${unit.conversionQty},
                selling_price = ${Number(unit.sellingPrice)},
                barcode = ${unit.barcode ?? null},
                updated_at = now()
              where id = ${unit.productUnitId} and product_id = ${id}
              returning id`;
            if (updated.length === 0) {
              throw notFound("Unit produk tidak ditemukan.");
            }
          } else {
            await transaction`
              insert into product_units (
                product_id, unit_name, conversion_qty, selling_price, barcode
              )
              values (
                ${id}, ${unit.unitName.trim()}, ${unit.conversionQty},
                ${Number(unit.sellingPrice)}, ${unit.barcode ?? null}
              )`;
          }
        }
      }

      if (input.thresholds) {
        await transaction`
          delete from product_stock_thresholds where product_id = ${id}`;
        for (const threshold of input.thresholds) {
          await transaction`
            insert into product_stock_thresholds (product_id, location, min_qty)
            values (${id}, ${threshold.location}, ${threshold.minQty})`;
        }
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Nama unit atau barcode sudah dipakai.");
    }
    if (isForeignKeyViolation(error)) {
      throw notFound("Kategori tidak ditemukan.");
    }
    throw error;
  }

  const product = await getProduct(id);
  if (!product) throw notFound("Produk tidak ditemukan.");
  return product;
}

export async function setProductActive(
  id: string,
  active: boolean,
): Promise<ProductView> {
  const client = await getSqlClient();
  const rows = await client`
    update products
    set is_active = ${active}, updated_at = now()
    where id = ${id}
    returning id`;
  if (rows.length === 0) throw notFound("Produk tidak ditemukan.");
  const product = await getProduct(id);
  if (!product) throw notFound("Produk tidak ditemukan.");
  return product;
}

export async function listCategories(): Promise<CategoryView[]> {
  const client = await getSqlClient();
  const rows = await client`
    select id, name, created_at, updated_at
    from categories
    order by name, id`;
  return rows.map(mapCategory);
}

function mapCategory(row: Record<string, unknown>): CategoryView {
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function createCategory(input: {
  name: string;
}): Promise<CategoryView> {
  const client = await getSqlClient();
  try {
    const [row] = await client`
      insert into categories (name)
      values (${assertNonBlank(input.name, "Nama kategori")})
      returning id, name, created_at, updated_at`;
    return mapCategory(row);
  } catch (error) {
    if (isUniqueViolation(error))
      throw conflict("Nama kategori sudah dipakai.");
    throw error;
  }
}

export async function updateCategory(
  id: string,
  input: { name: string },
): Promise<CategoryView> {
  const client = await getSqlClient();
  try {
    const [row] = await client`
      update categories
      set name = ${assertNonBlank(input.name, "Nama kategori")}, updated_at = now()
      where id = ${id}
      returning id, name, created_at, updated_at`;
    if (!row) throw notFound("Kategori tidak ditemukan.");
    return mapCategory(row);
  } catch (error) {
    if (isUniqueViolation(error))
      throw conflict("Nama kategori sudah dipakai.");
    throw error;
  }
}

function mapSupplier(row: Record<string, unknown>): SupplierView {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function listSuppliers(input: {
  filter?: { search?: string | null; isActive?: boolean | null } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<SupplierPageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    { name: "s.name", createdAt: "s.created_at", updatedAt: "s.updated_at" },
    "s.created_at",
  );
  const search = input.filter?.search ? `%${input.filter.search}%` : null;
  const isActive = input.filter?.isActive ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from suppliers s
    where (${search}::text is null or s.name ilike ${search})
      and (${isActive}::boolean is null or s.is_active = ${isActive})`;

  const rows = await client`
    select
      id, name, phone, address, notes, is_active, created_at, updated_at
    from suppliers s
    where (${search}::text is null or s.name ilike ${search})
      and (${isActive}::boolean is null or s.is_active = ${isActive})
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`;

  return {
    items: rows.map(mapSupplier),
    pageInfo: pageInfo(page, Number(countRow.total)),
  };
}

export async function getSupplier(id: string): Promise<SupplierView | null> {
  const client = await getSqlClient();
  const [row] = await client`
    select id, name, phone, address, notes, is_active, created_at, updated_at
    from suppliers
    where id = ${id}
    limit 1`;
  return row ? mapSupplier(row) : null;
}

export async function createSupplier(input: {
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}): Promise<SupplierView> {
  const client = await getSqlClient();
  const [row] = await client`
    insert into suppliers (name, phone, address, notes)
    values (
      ${assertNonBlank(input.name, "Nama supplier")},
      ${input.phone ?? null}, ${input.address ?? null}, ${input.notes ?? null}
    )
    returning id, name, phone, address, notes, is_active, created_at, updated_at`;
  return mapSupplier(row);
}

export async function updateSupplier(
  id: string,
  input: {
    name: string;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
  },
): Promise<SupplierView> {
  const client = await getSqlClient();
  const [row] = await client`
    update suppliers
    set
      name = ${assertNonBlank(input.name, "Nama supplier")},
      phone = ${input.phone ?? null},
      address = ${input.address ?? null},
      notes = ${input.notes ?? null},
      updated_at = now()
    where id = ${id}
    returning id, name, phone, address, notes, is_active, created_at, updated_at`;
  if (!row) throw notFound("Supplier tidak ditemukan.");
  return mapSupplier(row);
}

export async function setSupplierActive(
  id: string,
  active: boolean,
): Promise<SupplierView> {
  const client = await getSqlClient();
  const [row] = await client`
    update suppliers
    set is_active = ${active}, updated_at = now()
    where id = ${id}
    returning id, name, phone, address, notes, is_active, created_at, updated_at`;
  if (!row) throw notFound("Supplier tidak ditemukan.");
  return mapSupplier(row);
}

function mapCustomer(row: Record<string, unknown>): CustomerView {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    isActive: row.is_active as boolean,
    outstandingReceivable: money(row.outstanding_receivable),
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function listCustomers(input: {
  filter?: { search?: string | null; isActive?: boolean | null } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<CustomerPageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    { name: "c.name", createdAt: "c.created_at", updatedAt: "c.updated_at" },
    "c.created_at",
  );
  const search = input.filter?.search ? `%${input.filter.search}%` : null;
  const isActive = input.filter?.isActive ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from customers c
    where (${search}::text is null or c.name ilike ${search})
      and (${isActive}::boolean is null or c.is_active = ${isActive})`;

  const rows = await client`
    select c.id, c.name, c.phone, c.address, c.notes, c.is_active,
      c.created_at, c.updated_at,
      coalesce((
        select sum(v.outstanding)::bigint
        from v_sale_balances v
        join sales s on s.id = v.sale_id
        where s.customer_id = c.id
      ), 0) as outstanding_receivable
    from customers c
    where (${search}::text is null or c.name ilike ${search})
      and (${isActive}::boolean is null or c.is_active = ${isActive})
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`;

  return {
    items: rows.map(mapCustomer),
    pageInfo: pageInfo(page, Number(countRow.total)),
  };
}

export async function getCustomer(id: string): Promise<CustomerView | null> {
  const client = await getSqlClient();
  const [row] = await client`
    select c.id, c.name, c.phone, c.address, c.notes, c.is_active,
      c.created_at, c.updated_at,
      coalesce((
        select sum(v.outstanding)::bigint
        from v_sale_balances v
        join sales s on s.id = v.sale_id
        where s.customer_id = c.id
      ), 0) as outstanding_receivable
    from customers c
    where c.id = ${id}
    limit 1`;
  return row ? mapCustomer(row) : null;
}

export async function createCustomer(input: {
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}): Promise<CustomerView> {
  const client = await getSqlClient();
  const [row] = await client`
    insert into customers (name, phone, address, notes)
    values (
      ${assertNonBlank(input.name, "Nama customer")},
      ${input.phone ?? null}, ${input.address ?? null}, ${input.notes ?? null}
    )
    returning id`;
  const customer = await getCustomer(row.id);
  if (!customer) throw notFound("Customer tidak ditemukan.");
  return customer;
}

export async function updateCustomer(
  id: string,
  input: {
    name: string;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
  },
): Promise<CustomerView> {
  const client = await getSqlClient();
  const rows = await client`
    update customers
    set
      name = ${assertNonBlank(input.name, "Nama customer")},
      phone = ${input.phone ?? null},
      address = ${input.address ?? null},
      notes = ${input.notes ?? null},
      updated_at = now()
    where id = ${id}
    returning id`;
  if (rows.length === 0) throw notFound("Customer tidak ditemukan.");
  const customer = await getCustomer(id);
  if (!customer) throw notFound("Customer tidak ditemukan.");
  return customer;
}

export async function setCustomerActive(
  id: string,
  active: boolean,
): Promise<CustomerView> {
  const client = await getSqlClient();
  const rows = await client`
    update customers
    set is_active = ${active}, updated_at = now()
    where id = ${id}
    returning id`;
  if (rows.length === 0) throw notFound("Customer tidak ditemukan.");
  const customer = await getCustomer(id);
  if (!customer) throw notFound("Customer tidak ditemukan.");
  return customer;
}

export async function catalogSync(
  since: Date | null,
): Promise<CatalogSyncView> {
  const client = await getSqlClient();
  const sinceValue = since?.toISOString() ?? null;

  const productRows = (await client`
    select p.id, p.sku, p.name, p.category_id, p.base_unit, p.avg_cost,
      p.is_active, p.created_at, p.updated_at,
      c.name as category_name,
      c.created_at as category_created_at,
      c.updated_at as category_updated_at
    from products p
    join categories c on c.id = p.category_id
    where (${sinceValue}::timestamptz is null or p.updated_at > ${sinceValue}::timestamptz)
    order by p.updated_at, p.id`) as ProductRow[];

  const categoryRows = await client`
    select id, name, created_at, updated_at
    from categories
    where (${sinceValue}::timestamptz is null or updated_at > ${sinceValue}::timestamptz)
    order by updated_at, id`;

  const supplierRows = await client`
    select id, name, phone, address, notes, is_active, created_at, updated_at
    from suppliers
    where (${sinceValue}::timestamptz is null or updated_at > ${sinceValue}::timestamptz)
    order by updated_at, id`;

  return {
    serverTime: new Date(),
    products: await hydrateProducts(client, productRows),
    categories: categoryRows.map(mapCategory),
    suppliers: supplierRows.map(mapSupplier),
    tombstones: [],
  };
}

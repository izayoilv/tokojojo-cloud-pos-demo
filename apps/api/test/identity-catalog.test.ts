import assert from "node:assert/strict";
import { after, test } from "node:test";

import { randomSuffix, testSql } from "./db.ts";

after(() => testSql.end());

async function expectPgError(
  promise: Promise<unknown>,
  code: string,
  constraint?: string,
) {
  await assert.rejects(promise, (error: unknown) => {
    const pgError = error as {
      code?: string;
      constraint?: string;
      constraint_name?: string;
    };
    assert.equal(pgError.code, code);
    if (constraint !== undefined) {
      assert.equal(pgError.constraint ?? pgError.constraint_name, constraint);
    }
    return true;
  });
}

async function createProduct(): Promise<string> {
  const suffix = randomSuffix();
  const [category] = await testSql`
    insert into categories (name)
    values (${`Category ${suffix}`})
    returning id`;
  const [product] = await testSql`
    insert into products (sku, name, category_id, base_unit)
    values (${`SKU-${suffix}`}, ${`Product ${suffix}`}, ${category.id}, 'pcs')
    returning id`;
  return product.id;
}

test("users accepts all four roles", async () => {
  for (const role of ["OWNER", "ADMIN", "CASHIER", "WAREHOUSE"]) {
    const suffix = randomSuffix();
    const [user] = await testSql`
      insert into users (name, username, password_hash, role)
      values (${`User ${suffix}`}, ${`user-${suffix}`}, 'hash', ${role})
      returning role, is_active`;

    assert.equal(user.role, role);
    assert.equal(user.is_active, true);
  }
});

test("users rejects a duplicate username", async () => {
  const suffix = randomSuffix();
  const username = `user-${suffix}`;

  await testSql`
    insert into users (name, username, password_hash, role)
    values (${`User ${suffix}`}, ${username}, 'hash', 'CASHIER')`;

  await expectPgError(
    testSql`
      insert into users (name, username, password_hash, role)
      values (${`Other ${suffix}`}, ${username}, 'hash', 'ADMIN')`,
    "23505",
    "users_username_unique",
  );
});

test("users rejects a missing name", async () => {
  await expectPgError(
    testSql`
      insert into users (username, password_hash, role)
      values (${`user-${randomSuffix()}`}, 'hash', 'CASHIER')`,
    "23502",
  );
});

test("users rejects an invalid role", async () => {
  const suffix = randomSuffix();

  await expectPgError(
    testSql`
      insert into users (name, username, password_hash, role)
      values (${`User ${suffix}`}, ${`user-${suffix}`}, 'hash', 'SUPERADMIN')`,
    "22P02",
  );
});

test("categories reject a duplicate name", async () => {
  const name = `Category ${randomSuffix()}`;

  await testSql`
    insert into categories (name)
    values (${name})`;

  await expectPgError(
    testSql`
      insert into categories (name)
      values (${name})`,
    "23505",
    "categories_name_unique",
  );
});

test("products reject a duplicate sku", async () => {
  const suffix = randomSuffix();
  const sku = `SKU-${suffix}`;
  const [category] = await testSql`
    insert into categories (name)
    values (${`Category ${suffix}`})
    returning id`;

  await testSql`
    insert into products (sku, name, category_id, base_unit)
    values (${sku}, ${`Product ${suffix}`}, ${category.id}, 'pcs')`;

  await expectPgError(
    testSql`
      insert into products (sku, name, category_id, base_unit)
      values (${sku}, ${`Other ${suffix}`}, ${category.id}, 'pcs')`,
    "23505",
    "products_sku_unique",
  );
});

test("products require a category", async () => {
  const suffix = randomSuffix();

  await assert.rejects(
    testSql`
      insert into products (sku, name, base_unit)
      values (${`SKU-NULL-${suffix}`}, ${`Product ${suffix}`}, 'pcs')`,
    (error: unknown) => {
      const pgError = error as { code?: string; column_name?: string };
      assert.equal(pgError.code, "23502");
      assert.equal(pgError.column_name, "category_id");
      return true;
    },
  );
});

test("products keep the category referenced by a product", async () => {
  const suffix = randomSuffix();
  const [category] = await testSql`
    insert into categories (name)
    values (${`Category ${suffix}`})
    returning id`;
  const [categorized] = await testSql`
    insert into products (sku, name, category_id, base_unit)
    values (${`SKU-${suffix}`}, ${`Product with category ${suffix}`}, ${category.id}, 'pcs')
    returning id, category_id`;

  assert.equal(categorized.category_id, category.id);

  await expectPgError(
    testSql`delete from categories where id = ${category.id}`,
    // PostgreSQL 18 raises 23001 restrict_violation for ON DELETE RESTRICT.
    // https://www.postgresql.org/docs/18/errcodes-appendix.html
    "23001",
    "products_category_id_categories_id_fk",
  );

  const [reloaded] = await testSql`
    select category_id
    from products
    where id = ${categorized.id}`;

  assert.equal(reloaded.category_id, category.id);
});

test("product_units rejects a zero conversion and a negative selling price", async () => {
  const productId = await createProduct();

  await expectPgError(
    testSql`
      insert into product_units (product_id, unit_name, conversion_qty, selling_price)
      values (${productId}, ${`zero-${randomSuffix()}`}, 0, 1000)`,
    "23514",
    "product_units_conversion_qty_positive",
  );

  await expectPgError(
    testSql`
      insert into product_units (product_id, unit_name, conversion_qty, selling_price)
      values (${productId}, ${`negative-${randomSuffix()}`}, 1, -1)`,
    "23514",
    "product_units_selling_price_non_negative",
  );
});

test("product_units rejects duplicate barcodes and duplicate product unit names", async () => {
  const firstProductId = await createProduct();
  const secondProductId = await createProduct();
  const barcode = `barcode-${randomSuffix()}`;
  const unitName = `unit-${randomSuffix()}`;

  await testSql`
    insert into product_units (product_id, unit_name, conversion_qty, selling_price, barcode)
    values (${firstProductId}, ${unitName}, 1, 1000, ${barcode})`;

  await expectPgError(
    testSql`
      insert into product_units (product_id, unit_name, conversion_qty, selling_price, barcode)
      values (${secondProductId}, ${`other-${randomSuffix()}`}, 1, 1000, ${barcode})`,
    "23505",
    "product_units_barcode_unique",
  );

  await expectPgError(
    testSql`
      insert into product_units (product_id, unit_name, conversion_qty, selling_price)
      values (${firstProductId}, ${unitName}, 1, 1000)`,
    "23505",
    "product_units_product_id_unit_name_unique",
  );
});

test("product_units allows multiple units without a barcode", async () => {
  const productId = await createProduct();

  await testSql`
    insert into product_units (product_id, unit_name, conversion_qty, selling_price)
    values (${productId}, ${`no-barcode-a-${randomSuffix()}`}, 1, 1000)`;

  await testSql`
    insert into product_units (product_id, unit_name, conversion_qty, selling_price)
    values (${productId}, ${`no-barcode-b-${randomSuffix()}`}, 1, 1000)`;
});

test("product_stock_thresholds rejects a duplicate product and location", async () => {
  const productId = await createProduct();

  await testSql`
    insert into product_stock_thresholds (product_id, location, min_qty)
    values (${productId}, 'WAREHOUSE', 5)`;

  await expectPgError(
    testSql`
      insert into product_stock_thresholds (product_id, location, min_qty)
      values (${productId}, 'WAREHOUSE', 10)`,
    "23505",
    "product_stock_thresholds_product_id_location_pk",
  );

  await testSql`
    insert into product_stock_thresholds (product_id, location, min_qty)
    values (${productId}, 'STORE', 2)`;
});

test("product_stock_thresholds rejects a negative minimum quantity", async () => {
  const productId = await createProduct();

  await expectPgError(
    testSql`
      insert into product_stock_thresholds (product_id, location, min_qty)
      values (${productId}, 'WAREHOUSE', -1)`,
    "23514",
    "product_stock_thresholds_min_qty_non_negative",
  );
});

test("products reject a negative average cost", async () => {
  const suffix = randomSuffix();
  const [category] = await testSql`
    insert into categories (name)
    values (${`Category ${suffix}`})
    returning id`;

  await expectPgError(
    testSql`
      insert into products (sku, name, category_id, base_unit, avg_cost)
      values (
        ${`SKU-${suffix}`}, ${`Product ${suffix}`}, ${category.id}, 'pcs', -1
      )`,
    "23514",
    "products_avg_cost_non_negative",
  );
});

test("master data rejects blank display names", async () => {
  const suffix = randomSuffix();

  await expectPgError(
    testSql`
      insert into users (name, username, password_hash, role)
      values ('', ${`blank-name-${suffix}`}, 'hash', 'CASHIER')`,
    "23514",
    "users_name_not_blank",
  );

  await expectPgError(
    testSql`
      insert into users (name, username, password_hash, role)
      values (${`Blank ${suffix}`}, '   ', 'hash', 'CASHIER')`,
    "23514",
    "users_username_not_blank",
  );

  await expectPgError(
    testSql`insert into customers (name) values ('   ')`,
    "23514",
    "customers_name_not_blank",
  );

  await expectPgError(
    testSql`insert into categories (name) values ('   ')`,
    "23514",
    "categories_name_not_blank",
  );

  await expectPgError(
    testSql`insert into suppliers (name) values ('   ')`,
    "23514",
    "suppliers_name_not_blank",
  );

  const [category] = await testSql`
    insert into categories (name)
    values (${`Category ${suffix}`})
    returning id`;

  await expectPgError(
    testSql`
      insert into products (sku, name, category_id, base_unit)
      values ('   ', ${`Product ${suffix}`}, ${category.id}, 'pcs')`,
    "23514",
    "products_sku_not_blank",
  );

  await expectPgError(
    testSql`
      insert into products (sku, name, category_id, base_unit)
      values (${`SKU-${suffix}-blank-name`}, '   ', ${category.id}, 'pcs')`,
    "23514",
    "products_name_not_blank",
  );

  await expectPgError(
    testSql`
      insert into products (sku, name, category_id, base_unit)
      values (${`SKU-${suffix}-blank-unit`}, ${`Product ${suffix}`}, ${category.id}, '')`,
    "23514",
    "products_base_unit_not_blank",
  );

  const [product] = await testSql`
    insert into products (sku, name, category_id, base_unit)
    values (${`SKU-${suffix}-units`}, ${`Product ${suffix}`}, ${category.id}, 'pcs')
    returning id`;

  await expectPgError(
    testSql`
      insert into product_units (product_id, unit_name, conversion_qty, selling_price)
      values (${product.id}, '   ', 1, 1000)`,
    "23514",
    "product_units_unit_name_not_blank",
  );
});

test("products has no warehouse or store stock columns", async () => {
  const columns = await testSql`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'products'`;
  const columnNames = columns.map((column) => column.column_name);

  assert.ok(columnNames.includes("sku"));
  assert.ok(columnNames.includes("avg_cost"));
  assert.equal(columnNames.includes("stock_warehouse"), false);
  assert.equal(columnNames.includes("stock_store"), false);
});

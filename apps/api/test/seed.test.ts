import assert from "node:assert/strict";
import { after, test } from "node:test";

import { verify } from "@node-rs/argon2";

import {
  OPENING_STOCK,
  SEED_CATEGORY_IDS,
  SEED_PASSWORD,
  SEED_PRODUCT_IDS,
  SEED_SUPPLIER_IDS,
  SEED_USER_IDS,
  seedDatabase,
} from "../src/db/seed.ts";
import { testSql } from "./db.ts";

after(() => testSql.end());

const userIds = Object.values(SEED_USER_IDS);
const openingStockIds = OPENING_STOCK.map((opening) => opening.id);

async function countSeededRows() {
  const [users] = await testSql`
    select count(*)::int as total
    from users
    where id = any(${userIds}::uuid[])`;
  const [categories] = await testSql`
    select count(*)::int as total
    from categories
    where id = any(${SEED_CATEGORY_IDS}::uuid[])`;
  const [products] = await testSql`
    select count(*)::int as total
    from products
    where id = any(${SEED_PRODUCT_IDS}::uuid[])`;
  const [units] = await testSql`
    select count(*)::int as total
    from product_units
    where product_id = any(${SEED_PRODUCT_IDS}::uuid[])`;
  const [thresholds] = await testSql`
    select count(*)::int as total
    from product_stock_thresholds
    where product_id = any(${SEED_PRODUCT_IDS}::uuid[])`;
  const [suppliers] = await testSql`
    select count(*)::int as total
    from suppliers
    where id = any(${SEED_SUPPLIER_IDS}::uuid[])`;
  const [movements] = await testSql`
    select count(*)::int as total
    from stock_movements
    where id = any(${openingStockIds}::uuid[])`;

  return {
    users: users.total,
    categories: categories.total,
    products: products.total,
    units: units.total,
    thresholds: thresholds.total,
    suppliers: suppliers.total,
    movements: movements.total,
  };
}

test("seed is idempotent and creates the development store data", async () => {
  await seedDatabase(testSql);
  const first = await countSeededRows();

  await seedDatabase(testSql);
  const second = await countSeededRows();

  assert.deepEqual(second, first);
  assert.equal(first.users, 4);
  assert.equal(first.categories, SEED_CATEGORY_IDS.length);
  assert.equal(first.products, SEED_PRODUCT_IDS.length);
  assert.equal(first.suppliers, SEED_SUPPLIER_IDS.length);
  assert.equal(first.movements, OPENING_STOCK.length);
  assert.ok(first.units >= SEED_PRODUCT_IDS.length);
  assert.equal(first.thresholds, SEED_PRODUCT_IDS.length * 2);

  const users = await testSql`
    select username, role
    from users
    where id = any(${userIds}::uuid[])
    order by username`;
  assert.deepEqual(
    users.map((user) => [user.username, user.role]),
    [
      ["admin", "ADMIN"],
      ["gudang", "WAREHOUSE"],
      ["kasir", "CASHIER"],
      ["owner", "OWNER"],
    ],
  );

  const productsWithoutUnits = await testSql`
    select p.id
    from products p
    where p.id = any(${SEED_PRODUCT_IDS}::uuid[])
      and not exists (
        select 1 from product_units u where u.product_id = p.id
      )`;
  assert.equal(productsWithoutUnits.length, 0);

  const movements = await testSql`
    select
      id, product_id, location, qty_change,
      movement_type, reference_type, reference_id
    from stock_movements
    where id = any(${openingStockIds}::uuid[])`;
  assert.equal(movements.length, OPENING_STOCK.length);

  const movementsById = new Map(
    movements.map((movement) => [movement.id, movement]),
  );
  for (const opening of OPENING_STOCK) {
    const movement = movementsById.get(opening.id);
    assert.ok(movement, `missing opening movement ${opening.id}`);
    assert.equal(movement.product_id, opening.productId);
    assert.equal(movement.location, opening.location);
    assert.equal(Number(movement.qty_change), opening.qty);
    assert.equal(movement.movement_type, "ADJUSTMENT");
    assert.equal(movement.reference_type, "MANUAL");
    assert.equal(movement.reference_id, null);
  }
});

test("seed hashes the four staff passwords with Argon2id", async () => {
  await seedDatabase(testSql);

  const users = await testSql`
    select username, password_hash
    from users
    where id = any(${userIds}::uuid[])
    order by username`;

  assert.equal(users.length, 4);
  for (const user of users) {
    assert.match(user.password_hash, /^\$argon2id\$/);
    assert.equal(await verify(user.password_hash, SEED_PASSWORD), true);
  }
  assert.equal(await verify(users[0].password_hash, "not-the-password"), false);
});

test("seed refuses production unless SEED_ALLOW=1", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSeedAllow = process.env.SEED_ALLOW;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.SEED_ALLOW;

    await assert.rejects(seedDatabase(testSql), /SEED_ALLOW=1/);

    process.env.SEED_ALLOW = "1";
    await seedDatabase(testSql);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;

    if (previousSeedAllow === undefined) delete process.env.SEED_ALLOW;
    else process.env.SEED_ALLOW = previousSeedAllow;
  }
});

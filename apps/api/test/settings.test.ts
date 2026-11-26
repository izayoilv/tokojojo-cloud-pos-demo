import assert from "node:assert/strict";
import { after, test } from "node:test";

import { seedDatabase } from "../src/db/seed.ts";
import { testSql } from "./db.ts";

after(() => testSql.end());

async function clearSettings(): Promise<void> {
  await testSql`delete from receipt_settings`;
  await testSql`delete from store_settings`;
}

test("settings tables are singletons with defaults", async () => {
  await clearSettings();

  const [store] = await testSql`
    insert into store_settings (store_name)
    values ('Toko Uji')
    returning *`;
  assert.equal(store.id, true);
  assert.equal(store.default_location, "STORE");
  assert.equal(store.low_stock_guidance, null);
  assert.ok(store.updated_at instanceof Date);

  const [receipt] = await testSql`
    insert into receipt_settings default values
    returning *`;
  assert.equal(receipt.id, true);
  assert.equal(receipt.paper_size, "MM80");
  assert.equal(receipt.show_price, true);
  assert.equal(receipt.auto_print, false);
  assert.ok(receipt.updated_at instanceof Date);

  await assert.rejects(
    testSql`insert into store_settings (id, store_name) values (false, 'Other')`,
    (error: unknown) => {
      const pgError = error as {
        constraint?: string;
        constraint_name?: string;
      };
      const name = pgError.constraint ?? pgError.constraint_name;
      return (
        name === "store_settings_singleton" || name === "store_settings_pkey"
      );
    },
  );
  await assert.rejects(
    testSql`insert into receipt_settings (id) values (false)`,
    (error: unknown) => {
      const pgError = error as {
        constraint?: string;
        constraint_name?: string;
      };
      const name = pgError.constraint ?? pgError.constraint_name;
      return (
        name === "receipt_settings_singleton" ||
        name === "receipt_settings_pkey"
      );
    },
  );
});

test("settings reject a blank store name and accept overrides", async () => {
  await clearSettings();
  await assert.rejects(
    testSql`insert into store_settings (store_name) values ('   ')`,
    (error: unknown) => {
      const pgError = error as {
        constraint?: string;
        constraint_name?: string;
      };
      return (
        (pgError.constraint ?? pgError.constraint_name) ===
        "store_settings_name_not_blank"
      );
    },
  );

  const [store] = await testSql`
    insert into store_settings (
      store_name, tagline, city, default_location, low_stock_guidance
    )
    values ('Toko Uji', 'Tagline', 'Batam', 'WAREHOUSE', 'Segera restok.')
    returning *`;
  assert.equal(store.default_location, "WAREHOUSE");
  assert.equal(store.low_stock_guidance, "Segera restok.");

  const [receipt] = await testSql`
    insert into receipt_settings (paper_size, show_price, footer_text, auto_print)
    values ('MM58', false, 'Terima kasih', true)
    returning *`;
  assert.equal(receipt.paper_size, "MM58");
  assert.equal(receipt.show_price, false);
  assert.equal(receipt.footer_text, "Terima kasih");
  assert.equal(receipt.auto_print, true);
});

test("seed inserts both settings rows idempotently", async () => {
  await clearSettings();
  await seedDatabase(testSql);
  const [first] = await testSql`
    select
      (select count(*)::int from store_settings) as stores,
      (select count(*)::int from receipt_settings) as receipts`;
  assert.deepEqual(first, { stores: 1, receipts: 1 });

  await seedDatabase(testSql);
  const [second] = await testSql`
    select
      (select count(*)::int from store_settings) as stores,
      (select count(*)::int from receipt_settings) as receipts`;
  assert.deepEqual(second, { stores: 1, receipts: 1 });
});

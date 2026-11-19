import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";

import { db, sql } from "./client.js";
import * as s from "./schema/index.js";

async function main() {
  // 1. Tenant
  await db
    .insert(s.tenants)
    .values({ name: "Toko Jojo", slug: "tokojojo" })
    .onConflictDoNothing();
  const [tenant] = await db
    .select()
    .from(s.tenants)
    .where(eq(s.tenants.slug, "tokojojo"))
    .limit(1);
  if (!tenant) throw new Error("Tenant seed failed");

  // 2. Users (Owner & Kasir)
  const passwordHash = await hash("password123", {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await db
    .insert(s.users)
    .values([
      {
        tenantId: tenant.id,
        email: "owner@tokojojo.local",
        name: "Johan",
        passwordHash,
        role: "owner",
      },
      {
        tenantId: tenant.id,
        email: "kasir@tokojojo.local",
        name: "Kasir 1",
        passwordHash,
        role: "kasir",
      },
    ])
    .onConflictDoNothing();

  // 3. Categories
  await db
    .insert(s.categories)
    .values([
      { tenantId: tenant.id, name: "Sembako" },
      { tenantId: tenant.id, name: "Minuman" },
    ])
    .onConflictDoNothing();

  // 4. Products & Product Units
  const [beras] = await db
    .insert(s.products)
    .values({
      tenantId: tenant.id,
      name: "Beras Ramos",
      baseUnit: "Kg",
      currentStock: "50.00",
      baseCostPrice: "12000.00",
      minStockAlert: "10.00",
    })
    .returning();

  await db
    .insert(s.productUnits)
    .values([
      {
        tenantId: tenant.id,
        productId: beras.id,
        unitName: "Ecer 1 Kg",
        conversionQty: "1.00",
        sellingPrice: "15000.00",
      },
      {
        tenantId: tenant.id,
        productId: beras.id,
        unitName: "Karung 25 Kg",
        conversionQty: "25.00",
        sellingPrice: "355000.00",
      },
    ])
    .onConflictDoNothing();

  console.log("✅ Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

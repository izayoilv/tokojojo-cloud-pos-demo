import { hash } from "@node-rs/argon2";
import { and, eq } from "drizzle-orm";

import { db, sql } from "./client.js";
import * as s from "./schema/index.js";

const seedIds = {
  tenant: "01930000-0000-7000-8000-000000000001",
  owner: "01930000-0000-7000-8000-000000000002",
  kasir: "01930000-0000-7000-8000-000000000003",
  sembako: "01930000-0000-7000-8000-000000000004",
  minuman: "01930000-0000-7000-8000-000000000005",
  beras: "01930000-0000-7000-8000-000000000006",
  ecer: "01930000-0000-7000-8000-000000000007",
  karung: "01930000-0000-7000-8000-000000000008",
} as const;

function assertSeedingAllowed() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW !== "1") {
    throw new Error(
      "Refusing to seed a production database; set SEED_ALLOW=1 to override",
    );
  }
}

async function main() {
  assertSeedingAllowed();

  const ownerHash = await hash("password123", {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const kasirHash = await hash("password123", {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await db.transaction(async (tx) => {
    await tx
      .insert(s.tenants)
      .values({ id: seedIds.tenant, name: "Toko Jojo", slug: "tokojojo" })
      .onConflictDoUpdate({
        target: s.tenants.slug,
        set: { name: "Toko Jojo" },
      });

    const [tenant] = await tx
      .select()
      .from(s.tenants)
      .where(eq(s.tenants.slug, "tokojojo"))
      .limit(1);
    if (!tenant) throw new Error("Tenant seed failed");

    const users = [
      {
        id: seedIds.owner,
        email: "owner@tokojojo.local",
        name: "Johan",
        passwordHash: ownerHash,
        role: "owner" as const,
      },
      {
        id: seedIds.kasir,
        email: "kasir@tokojojo.local",
        name: "Kasir 1",
        passwordHash: kasirHash,
        role: "kasir" as const,
      },
    ];

    for (const user of users) {
      await tx
        .insert(s.users)
        .values({ ...user, tenantId: tenant.id })
        .onConflictDoUpdate({
          target: [s.users.tenantId, s.users.email],
          set: {
            name: user.name,
            passwordHash: user.passwordHash,
            role: user.role,
            active: true,
            deletedAt: null,
          },
        });
    }

    const categories = [
      { id: seedIds.sembako, name: "Sembako" },
      { id: seedIds.minuman, name: "Minuman" },
    ];

    for (const category of categories) {
      await tx
        .insert(s.categories)
        .values({ ...category, tenantId: tenant.id })
        .onConflictDoUpdate({
          target: [s.categories.tenantId, s.categories.name],
          set: { deletedAt: null },
        });
    }

    const [existingProduct] = await tx
      .select()
      .from(s.products)
      .where(
        and(
          eq(s.products.tenantId, tenant.id),
          eq(s.products.name, "Beras Ramos"),
        ),
      )
      .limit(1);

    let productId = existingProduct?.id;

    if (existingProduct) {
      await tx
        .update(s.products)
        .set({
          baseUnit: "Kg",
          currentStock: "50.00",
          baseCostPrice: "12000.00",
          minStockAlert: "10.00",
          active: true,
          deletedAt: null,
        })
        .where(eq(s.products.id, existingProduct.id));
    } else {
      const [createdProduct] = await tx
        .insert(s.products)
        .values({
          id: seedIds.beras,
          tenantId: tenant.id,
          name: "Beras Ramos",
          baseUnit: "Kg",
          currentStock: "50.00",
          baseCostPrice: "12000.00",
          minStockAlert: "10.00",
        })
        .returning({ id: s.products.id });
      productId = createdProduct.id;
    }

    if (!productId) throw new Error("Product seed failed");

    const units = [
      {
        id: seedIds.ecer,
        unitName: "Ecer 1 Kg",
        conversionQty: "1.00",
        sellingPrice: "15000.00",
      },
      {
        id: seedIds.karung,
        unitName: "Karung 25 Kg",
        conversionQty: "25.00",
        sellingPrice: "355000.00",
      },
    ];

    for (const unit of units) {
      await tx
        .insert(s.productUnits)
        .values({ ...unit, tenantId: tenant.id, productId })
        .onConflictDoUpdate({
          target: [
            s.productUnits.tenantId,
            s.productUnits.productId,
            s.productUnits.unitName,
          ],
          set: {
            conversionQty: unit.conversionQty,
            sellingPrice: unit.sellingPrice,
          },
        });
    }
  });

  console.log("✅ Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

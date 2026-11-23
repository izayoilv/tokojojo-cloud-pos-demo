import { fileURLToPath } from "node:url";

import { hash } from "@node-rs/argon2";
import type postgres from "postgres";

import { sql } from "./client.ts";

export const SEED_PASSWORD = "tokojojo_dev";

// @node-rs/argon2 exports Algorithm as a const enum, which verbatimModuleSyntax
// cannot reference at runtime. 2 is Algorithm.Argon2id.
const ARGON2ID_ALGORITHM = 2;

function fixedUuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

export const SEED_USER_IDS = {
  owner: fixedUuid(101),
  admin: fixedUuid(102),
  cashier: fixedUuid(103),
  warehouse: fixedUuid(104),
} as const;

type SeedUser = {
  id: string;
  name: string;
  username: string;
  role: "OWNER" | "ADMIN" | "CASHIER" | "WAREHOUSE";
};

const seedUsers: SeedUser[] = [
  {
    id: SEED_USER_IDS.owner,
    name: "Sari Owner",
    username: "owner",
    role: "OWNER",
  },
  {
    id: SEED_USER_IDS.admin,
    name: "Budi Admin",
    username: "admin",
    role: "ADMIN",
  },
  {
    id: SEED_USER_IDS.cashier,
    name: "Rina Kasir",
    username: "kasir",
    role: "CASHIER",
  },
  {
    id: SEED_USER_IDS.warehouse,
    name: "Agus Gudang",
    username: "gudang",
    role: "WAREHOUSE",
  },
];

export const SEED_CATEGORY_IDS = [
  fixedUuid(201),
  fixedUuid(202),
  fixedUuid(203),
] as const;

const seedCategories = [
  { id: SEED_CATEGORY_IDS[0], name: "Sembako" },
  { id: SEED_CATEGORY_IDS[1], name: "Minuman" },
  { id: SEED_CATEGORY_IDS[2], name: "Rumah Tangga" },
];

export const SEED_SUPPLIER_IDS = [
  fixedUuid(501),
  fixedUuid(502),
  fixedUuid(503),
] as const;

const seedSuppliers = [
  {
    id: SEED_SUPPLIER_IDS[0],
    name: "PT Sumber Pangan Nusantara",
    phone: "021-5550101",
    address: "Jl. Pangan Raya No. 12, Jakarta",
  },
  {
    id: SEED_SUPPLIER_IDS[1],
    name: "CV Minuman Segar",
    phone: "021-5550202",
    address: "Jl. Segar No. 8, Bekasi",
  },
  {
    id: SEED_SUPPLIER_IDS[2],
    name: "UD Kebersihan Nusantara",
    phone: "021-5550303",
    address: "Jl. Bersih No. 3, Depok",
  },
];

type SeedUnit = {
  id: string;
  unitName: string;
  conversionQty: number;
  sellingPrice: number;
  barcode: string;
};

type SeedProduct = {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  baseUnit: string;
  units: SeedUnit[];
  thresholds: { WAREHOUSE: number; STORE: number };
  opening: { WAREHOUSE: number; STORE: number };
};

export const SEED_PRODUCT_IDS = [
  fixedUuid(301),
  fixedUuid(302),
  fixedUuid(303),
  fixedUuid(304),
  fixedUuid(305),
  fixedUuid(306),
] as const;

const seedProducts: SeedProduct[] = [
  {
    id: SEED_PRODUCT_IDS[0],
    sku: "BR-5KG",
    name: "Beras Premium 5 kg",
    categoryId: SEED_CATEGORY_IDS[0],
    baseUnit: "pcs",
    units: [
      {
        id: fixedUuid(401),
        unitName: "pcs",
        conversionQty: 1,
        sellingPrice: 68_000,
        barcode: "8991000000011",
      },
      {
        id: fixedUuid(402),
        unitName: "karung",
        conversionQty: 10,
        sellingPrice: 650_000,
        barcode: "8991000000028",
      },
    ],
    thresholds: { WAREHOUSE: 24, STORE: 10 },
    opening: { WAREHOUSE: 120, STORE: 24 },
  },
  {
    id: SEED_PRODUCT_IDS[1],
    sku: "MG-1L",
    name: "Minyak Goreng 1 L",
    categoryId: SEED_CATEGORY_IDS[0],
    baseUnit: "pcs",
    units: [
      {
        id: fixedUuid(403),
        unitName: "pcs",
        conversionQty: 1,
        sellingPrice: 19_000,
        barcode: "8991000000035",
      },
    ],
    thresholds: { WAREHOUSE: 24, STORE: 12 },
    opening: { WAREHOUSE: 96, STORE: 36 },
  },
  {
    id: SEED_PRODUCT_IDS[2],
    sku: "GP-1KG",
    name: "Gula Pasir 1 kg",
    categoryId: SEED_CATEGORY_IDS[0],
    baseUnit: "pcs",
    units: [
      {
        id: fixedUuid(404),
        unitName: "pcs",
        conversionQty: 1,
        sellingPrice: 16_000,
        barcode: "8991000000042",
      },
    ],
    thresholds: { WAREHOUSE: 20, STORE: 10 },
    opening: { WAREHOUSE: 80, STORE: 20 },
  },
  {
    id: SEED_PRODUCT_IDS[3],
    sku: "KP-SACHET",
    name: "Kopi Bubuk Sachet",
    categoryId: SEED_CATEGORY_IDS[1],
    baseUnit: "pcs",
    units: [
      {
        id: fixedUuid(405),
        unitName: "pcs",
        conversionQty: 1,
        sellingPrice: 2_500,
        barcode: "8991000000059",
      },
    ],
    thresholds: { WAREHOUSE: 40, STORE: 12 },
    opening: { WAREHOUSE: 200, STORE: 48 },
  },
  {
    id: SEED_PRODUCT_IDS[4],
    sku: "AM-600",
    name: "Air Mineral 600 ml",
    categoryId: SEED_CATEGORY_IDS[1],
    baseUnit: "pcs",
    units: [
      {
        id: fixedUuid(406),
        unitName: "pcs",
        conversionQty: 1,
        sellingPrice: 4_000,
        barcode: "8991000000066",
      },
      {
        id: fixedUuid(407),
        unitName: "dus",
        conversionQty: 24,
        sellingPrice: 90_000,
        barcode: "8991000000073",
      },
    ],
    thresholds: { WAREHOUSE: 48, STORE: 24 },
    opening: { WAREHOUSE: 144, STORE: 48 },
  },
  {
    id: SEED_PRODUCT_IDS[5],
    sku: "SM-BATANG",
    name: "Sabun Mandi Batang",
    categoryId: SEED_CATEGORY_IDS[2],
    baseUnit: "pcs",
    units: [
      {
        id: fixedUuid(408),
        unitName: "pcs",
        conversionQty: 1,
        sellingPrice: 4_500,
        barcode: "8991000000080",
      },
    ],
    thresholds: { WAREHOUSE: 24, STORE: 12 },
    opening: { WAREHOUSE: 60, STORE: 24 },
  },
];

export type OpeningStock = {
  id: string;
  productId: string;
  location: "WAREHOUSE" | "STORE";
  qty: number;
};

export const OPENING_STOCK: OpeningStock[] = seedProducts.flatMap(
  (product, productIndex) => [
    {
      id: fixedUuid(601 + productIndex * 2),
      productId: product.id,
      location: "WAREHOUSE" as const,
      qty: product.opening.WAREHOUSE,
    },
    {
      id: fixedUuid(602 + productIndex * 2),
      productId: product.id,
      location: "STORE" as const,
      qty: product.opening.STORE,
    },
  ],
);

function assertSeedAllowed(): void {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW !== "1") {
    throw new Error(
      "Refusing to seed production. Set SEED_ALLOW=1 to seed this database.",
    );
  }
}

export async function seedDatabase(client: postgres.Sql = sql): Promise<void> {
  assertSeedAllowed();

  const passwordHash = await hash(SEED_PASSWORD, {
    algorithm: ARGON2ID_ALGORITHM,
  });

  await client.begin(async (tx) => {
    for (const user of seedUsers) {
      await tx`
        insert into users (id, name, username, password_hash, role, is_active)
        values (
          ${user.id}, ${user.name}, ${user.username}, ${passwordHash},
          ${user.role}, true
        )
        on conflict (id) do update set
          name = excluded.name,
          username = excluded.username,
          password_hash = excluded.password_hash,
          role = excluded.role,
          is_active = excluded.is_active,
          updated_at = now()`;
    }

    for (const category of seedCategories) {
      await tx`
        insert into categories (id, name)
        values (${category.id}, ${category.name})
        on conflict (id) do update set
          name = excluded.name,
          updated_at = now()`;
    }

    for (const supplier of seedSuppliers) {
      await tx`
        insert into suppliers (id, name, phone, address, is_active)
        values (
          ${supplier.id}, ${supplier.name}, ${supplier.phone},
          ${supplier.address}, true
        )
        on conflict (id) do update set
          name = excluded.name,
          phone = excluded.phone,
          address = excluded.address,
          is_active = excluded.is_active,
          updated_at = now()`;
    }

    for (const product of seedProducts) {
      await tx`
        insert into products (
          id, sku, name, category_id, base_unit, avg_cost, is_active
        )
        values (
          ${product.id}, ${product.sku}, ${product.name},
          ${product.categoryId}, ${product.baseUnit}, 0, true
        )
        on conflict (id) do update set
          sku = excluded.sku,
          name = excluded.name,
          category_id = excluded.category_id,
          base_unit = excluded.base_unit,
          is_active = excluded.is_active,
          updated_at = now()`;

      for (const unit of product.units) {
        await tx`
          insert into product_units (
            id, product_id, unit_name, conversion_qty, selling_price, barcode
          )
          values (
            ${unit.id}, ${product.id}, ${unit.unitName},
            ${unit.conversionQty}, ${unit.sellingPrice}, ${unit.barcode}
          )
          on conflict (id) do update set
            unit_name = excluded.unit_name,
            conversion_qty = excluded.conversion_qty,
            selling_price = excluded.selling_price,
            barcode = excluded.barcode,
            updated_at = now()`;
      }

      for (const [location, minQty] of Object.entries(product.thresholds)) {
        await tx`
          insert into product_stock_thresholds (product_id, location, min_qty)
          values (${product.id}, ${location}, ${minQty})
          on conflict (product_id, location) do update set
            min_qty = excluded.min_qty,
            updated_at = now()`;
      }
    }

    for (const opening of OPENING_STOCK) {
      await tx`
        insert into stock_movements (
          id, product_id, location, qty_change, movement_type,
          reference_type, reference_id, notes, created_by
        )
        values (
          ${opening.id}, ${opening.productId}, ${opening.location},
          ${opening.qty}, 'ADJUSTMENT', 'MANUAL', null,
          'Opening stock seed', ${SEED_USER_IDS.owner}
        )
        on conflict (id) do nothing`;
    }
  });
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  try {
    await seedDatabase();
    console.log("Seed complete: one store, four users, and opening stock.");
  } finally {
    await sql.end();
  }
}

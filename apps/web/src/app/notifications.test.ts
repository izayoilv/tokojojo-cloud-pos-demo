import { describe, expect, it } from "vitest";

import type { Opname, Payable, Product, Role, Transfer } from "../data/types";
import { buildNotifications } from "./notifications";

const now = new Date("2026-11-27T10:00:00+07:00");

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "PRD-001",
  sku: "SKU-001",
  barcode: "899000000001",
  name: "Beras",
  category: "Sembako",
  brand: "TokoJojo",
  unit: "Pcs",
  cost: 1000,
  price: 1500,
  warehouseStock: 10,
  storeStock: 5,
  minStock: 5,
  minStoreStock: 2,
  color: "#000000",
  active: true,
  ...overrides,
});

const transfer = (overrides: Partial<Transfer> = {}): Transfer => ({
  id: "TRF-001",
  number: "MUT/2026/11/001",
  from: "WH-BACK",
  to: "STORE-FRONT",
  status: "PENDING",
  created: "2026-11-27T08:00:00+07:00",
  completed: null,
  createdBy: "Hendra",
  approvedBy: null,
  itemCount: 2,
  ...overrides,
});

const opname = (overrides: Partial<Opname> = {}): Opname => ({
  id: "OPN-001",
  number: "OPN/2026/11/001",
  location: "STORE-FRONT",
  status: "PENDING_REVIEW",
  created: "2026-11-27T08:00:00+07:00",
  createdBy: "Hendra",
  reviewedBy: null,
  items: [
    {
      productId: "PRD-001",
      productName: "Beras",
      systemQty: 10,
      physicalQty: 9,
    },
  ],
  ...overrides,
});

const payable = (overrides: Partial<Payable> = {}): Payable => ({
  id: "PAY-001",
  supplierName: "PT Sumber",
  invoice: "INV-001",
  due: "2026-11-30",
  total: 100000,
  paid: 0,
  status: "UNPAID",
  ...overrides,
});

const build = (role: Role) =>
  buildNotifications({
    role,
    now,
    products: [
      product({
        id: "HABIS",
        name: "Sunlight",
        warehouseStock: 0,
        storeStock: 0,
      }),
      product({
        id: "MENIPIS",
        name: "Gula",
        warehouseStock: 3,
        storeStock: 1,
      }),
      product({
        id: "ARCHIVED",
        name: "Produk Arsip",
        warehouseStock: 0,
        storeStock: 0,
        active: false,
      }),
    ],
    transfers: [transfer()],
    opnames: [opname()],
    payables: [
      payable({ id: "SOON", supplierName: "PT Cepat", due: "2026-11-30" }),
      payable({ id: "LATER", supplierName: "PT Lambat", due: "2026-12-20" }),
      payable({ id: "PAID", total: 50000, paid: 50000 }),
    ],
  });

describe("buildNotifications", () => {
  it("links stock alerts to inventory", () => {
    const items = build("OWNER");
    const stock = items.filter((item) => item.href === "/persediaan");

    expect(stock.map((item) => item.title)).toEqual([
      "Stok habis: Sunlight",
      "Stok menipis: Gula",
    ]);
    expect(stock.some((item) => item.title.includes("Produk Arsip"))).toBe(
      false,
    );
  });

  it("shows pending warehouse work to roles with GUDANG access", () => {
    const warehouse = build("WAREHOUSE");
    const owner = build("OWNER");
    const cashier = build("CASHIER");

    expect(
      warehouse.some((item) => item.title.includes("Mutasi pending")),
    ).toBe(true);
    expect(
      warehouse.some((item) => item.title.includes("Opname menunggu review")),
    ).toBe(false);
    expect(
      owner.some((item) => item.title.includes("Opname menunggu review")),
    ).toBe(true);
    expect(owner.some((item) => item.title.includes("Mutasi pending"))).toBe(
      true,
    );
    expect(
      warehouse.find((item) => item.title.includes("Mutasi pending"))?.href,
    ).toBe("/gudang?tab=mutasi");
    expect(
      owner.find((item) => item.title.includes("Opname menunggu"))?.href,
    ).toBe("/gudang?tab=opname");
    expect(cashier.some((item) => item.title.includes("Mutasi pending"))).toBe(
      false,
    );
  });

  it("links purchases only when a payable is due soon and unpaid", () => {
    const items = build("OWNER").filter((item) =>
      item.href.startsWith("/pembelian"),
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Hutang jatuh tempo: PT Cepat");
  });

  it("hides payables from roles without PEMBELIAN access", () => {
    expect(
      build("WAREHOUSE").some((item) => item.href.startsWith("/pembelian")),
    ).toBe(true);
    expect(
      build("CASHIER").some((item) => item.href.startsWith("/pembelian")),
    ).toBe(false);
  });
});

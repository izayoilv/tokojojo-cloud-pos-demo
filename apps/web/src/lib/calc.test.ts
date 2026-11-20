import { describe, expect, it } from "vitest";

import type { Product, Sale } from "../data/types";
import {
  inventoryValue,
  lowStockProducts,
  salesKpis,
  saleTotals,
  stockStatus,
} from "./calc";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "PRD-001",
  sku: "SMB-BRS-001",
  barcode: "8992761110012",
  name: "Beras Setra Ramos Cap Topi Koki 5kg",
  category: "Sembako Utama",
  brand: "Topi Koki",
  unit: "Karung",
  cost: 64200,
  price: 73500,
  warehouseStock: 45,
  storeStock: 12,
  minStock: 25,
  minStoreStock: 10,
  color: "#2563eb",
  ...overrides,
});

const sale = (overrides: Partial<Sale> = {}): Sale => ({
  id: "SALE-1",
  number: "POS/20250514/0001",
  time: "2025-05-14T08:30:00+07:00",
  cashier: "Dewi Lestari",
  terminal: "KASIR-DESKTOP-01",
  method: "TUNAI",
  status: "COMPLETED",
  received: 300000,
  items: [
    {
      productId: "PRD-001",
      name: "Beras",
      unit: "Karung",
      quantity: 2,
      price: 73500,
      cost: 64200,
      discount: 500,
      returned: 0,
    },
    {
      productId: "PRD-002",
      name: "Minyak",
      unit: "Pouch",
      quantity: 3,
      price: 37500,
      cost: 33000,
      discount: 0,
      returned: 1,
    },
  ],
  ...overrides,
});

describe("saleTotals", () => {
  it("applies discounts and excludes returned quantities from cost", () => {
    expect(saleTotals(sale())).toEqual({
      subtotal: 259500,
      discount: 1000,
      grandTotal: 258500,
      cogs: 194400,
    });
  });
});

describe("stockStatus", () => {
  it("is safe when both locations are above their minimums", () => {
    expect(stockStatus(product())).toBe("AMAN");
  });

  it("is low when the store stock reaches its minimum", () => {
    expect(stockStatus(product({ storeStock: 10 }))).toBe("MENIPIS");
  });

  it("is empty when total stock is zero", () => {
    expect(stockStatus(product({ warehouseStock: 0, storeStock: 0 }))).toBe(
      "HABIS",
    );
  });
});

describe("inventoryValue", () => {
  it("values warehouse and store stock at cost", () => {
    expect(inventoryValue([product()])).toBe(3659400);
  });

  it("returns zero for an empty catalogue", () => {
    expect(inventoryValue([])).toBe(0);
  });
});

describe("lowStockProducts", () => {
  it("returns only products at or below their minimums", () => {
    const safe = product({ id: "SAFE" });
    const low = product({ id: "LOW", warehouseStock: 5 });
    expect(lowStockProducts([safe, low]).map((item) => item.id)).toEqual([
      "LOW",
    ]);
  });
});

describe("salesKpis", () => {
  it("aggregates revenue, cost, profit, and margin", () => {
    const result = salesKpis([sale(), sale({ id: "SALE-2", items: [] })]);
    expect(result.revenue).toBe(258500);
    expect(result.cogs).toBe(194400);
    expect(result.grossProfit).toBe(64100);
    expect(result.margin).toBeCloseTo(24.8, 1);
  });

  it("returns zeros for no sales", () => {
    expect(salesKpis([])).toEqual({
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      margin: 0,
    });
  });
});

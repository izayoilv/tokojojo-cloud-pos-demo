import { describe, expect, it } from "vitest";

import type { Product, Sale } from "../data/types";
import {
  dailySalesSeries,
  inventoryValue,
  lowStockProducts,
  recordsCashRefund,
  recordsInRange,
  salesInRange,
  salesKpis,
  saleTotals,
  stockStatus,
  stockValuationByLocation,
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
  it("excludes returned quantities from revenue, discount, and cost", () => {
    expect(saleTotals(sale())).toEqual({
      subtotal: 222000,
      discount: 1000,
      grandTotal: 221000,
      cogs: 194400,
    });
  });

  it("reports zero totals for a voided sale", () => {
    expect(saleTotals(sale({ status: "VOIDED" }))).toEqual({
      subtotal: 0,
      discount: 0,
      grandTotal: 0,
      cogs: 0,
    });
  });
});

describe("recordsCashRefund", () => {
  it("only records cash refunds for paid methods", () => {
    expect(recordsCashRefund("TUNAI")).toBe(true);
    expect(recordsCashRefund("QRIS")).toBe(true);
    expect(recordsCashRefund("HUTANG")).toBe(false);
    expect(recordsCashRefund("CAMPURAN")).toBe(false);
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
    expect(result.revenue).toBe(221000);
    expect(result.cogs).toBe(194400);
    expect(result.grossProfit).toBe(26600);
    expect(result.margin).toBeCloseTo(12.0, 1);
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

describe("salesInRange", () => {
  const dated = [
    sale({ id: "TODAY", time: "2025-05-14T09:00:00+07:00" }),
    sale({ id: "SIX", time: "2025-05-08T09:00:00+07:00" }),
    sale({ id: "OLD", time: "2025-05-06T09:00:00+07:00" }),
    sale({ id: "PREV", time: "2025-04-30T09:00:00+07:00" }),
  ];

  it("keeps only the reference calendar day for TODAY", () => {
    expect(salesInRange(dated, "TODAY").map((item) => item.id)).toEqual([
      "TODAY",
    ]);
  });

  it("keeps the last seven days including the reference day", () => {
    expect(salesInRange(dated, "7DAYS").map((item) => item.id)).toEqual([
      "TODAY",
      "SIX",
    ]);
  });

  it("keeps the reference month for MONTH", () => {
    expect(salesInRange(dated, "MONTH").map((item) => item.id)).toEqual([
      "TODAY",
      "SIX",
      "OLD",
    ]);
  });

  it("returns everything for ALL and nothing for an empty list", () => {
    expect(salesInRange(dated, "ALL")).toHaveLength(4);
    expect(salesInRange([], "ALL")).toEqual([]);
  });

  it("keeps voided sales out of revenue summaries", () => {
    const voided = sale({ id: "VOID", status: "VOIDED" });
    const completed = sale({ id: "OK" });

    expect(salesKpis([completed, voided])).toEqual(salesKpis([completed]));
  });
});

describe("recordsInRange", () => {
  const records = [
    { id: "TODAY", time: "2025-05-14T09:00:00+07:00" },
    { id: "SIX", time: "2025-05-08T09:00:00+07:00" },
    { id: "OLD", time: "2025-05-06T09:00:00+07:00" },
    { id: "PREV", time: "2025-04-30T09:00:00+07:00" },
  ];
  const time = (record: (typeof records)[number]) => record.time;

  it("uses the latest record as the reference date", () => {
    expect(
      recordsInRange(records, time, "TODAY").map((item) => item.id),
    ).toEqual(["TODAY"]);
    expect(
      recordsInRange(records, time, "7DAYS").map((item) => item.id),
    ).toEqual(["TODAY", "SIX"]);
    expect(
      recordsInRange(records, time, "MONTH").map((item) => item.id),
    ).toEqual(["TODAY", "SIX", "OLD"]);
    expect(recordsInRange(records, time, "ALL")).toHaveLength(4);
  });

  it("returns nothing for an empty list", () => {
    expect(recordsInRange([], time, "MONTH")).toEqual([]);
  });
});

describe("dailySalesSeries", () => {
  it("groups sales by date in ascending order", () => {
    const series = dailySalesSeries(
      [
        sale({ id: "B", time: "2025-05-14T15:00:00+07:00" }),
        sale({ id: "A", time: "2025-05-13T09:00:00+07:00" }),
        sale({ id: "C", time: "2025-05-14T10:00:00+07:00" }),
      ],
      "ALL",
    );

    expect(series.map((point) => point.date)).toEqual([
      "2025-05-13",
      "2025-05-14",
    ]);
    expect(series[1]?.revenue).toBe(442000);
    expect(series[1]?.grossProfit).toBe(53200);
  });

  it("returns an empty series for no sales", () => {
    expect(dailySalesSeries([], "ALL")).toEqual([]);
  });
});

describe("stockValuationByLocation", () => {
  it("splits value between warehouse and store", () => {
    const result = stockValuationByLocation([product()]);

    expect(result).toHaveLength(2);
    expect(result[0]?.location).toBe("WH-BACK");
    expect(result[0]?.value).toBe(2889000);
    expect(result[1]?.location).toBe("STORE-FRONT");
    expect(result[1]?.value).toBe(770400);
  });

  it("returns zero-valued slices for an empty catalogue", () => {
    expect(stockValuationByLocation([]).map((slice) => slice.value)).toEqual([
      0, 0,
    ]);
  });
});

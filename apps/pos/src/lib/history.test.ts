import { describe, expect, it } from "vitest";

import { initialSales } from "../data/mock";
import type { PosSale } from "../data/types";
import { filterSales } from "./history";

const ids = (sales: PosSale[]) => sales.map((sale) => sale.id);

describe("filterSales", () => {
  it("orders sales newest first", () => {
    const shuffled = [
      initialSales[3],
      initialSales[1],
      initialSales[0],
      initialSales[2],
    ];
    expect(ids(filterSales(shuffled, "", "ALL", "ALL"))).toEqual([
      "SALE-001",
      "SALE-002",
      "SALE-003",
      "SALE-004",
    ]);
  });

  it("matches invoice, cashier, customer, and payment reference", () => {
    expect(ids(filterSales(initialSales, "00122", "ALL", "ALL"))).toEqual([
      "SALE-003",
    ]);
    expect(ids(filterSales(initialSales, "dewi", "ALL", "ALL"))).toHaveLength(
      4,
    );
    expect(ids(filterSales(initialSales, "warung", "ALL", "ALL"))).toEqual([
      "SALE-003",
    ]);
    expect(ids(filterSales(initialSales, "882104", "ALL", "ALL"))).toEqual([
      "SALE-003",
    ]);
  });

  it("filters by payment method and sale status", () => {
    expect(ids(filterSales(initialSales, "", "QRIS", "ALL"))).toEqual([
      "SALE-002",
      "SALE-003",
    ]);
    expect(ids(filterSales(initialSales, "", "ALL", "VOIDED"))).toEqual([
      "SALE-004",
    ]);
    expect(ids(filterSales(initialSales, "", "ALL", "PARTIAL_RETURN"))).toEqual(
      ["SALE-003"],
    );
  });

  it("returns no results for a miss", () => {
    expect(filterSales(initialSales, "tidak-ada", "ALL", "ALL")).toEqual([]);
  });
});

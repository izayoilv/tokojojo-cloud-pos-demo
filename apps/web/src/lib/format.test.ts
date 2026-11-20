import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  formatPercent,
  formatRupiah,
} from "./format";

describe("formatRupiah", () => {
  it("formats integer rupiah with Indonesian separators", () => {
    expect(formatRupiah(73500)).toBe("Rp 73.500");
  });

  it("formats zero", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp as an Indonesian short date", () => {
    expect(formatDate("2025-05-14T08:30:00+07:00")).toBe("14/05/2025");
  });

  it("returns a dash for an empty value", () => {
    expect(formatDate("")).toBe("-");
  });
});

describe("formatDateTime", () => {
  it("formats an ISO timestamp with hours and minutes", () => {
    expect(formatDateTime("2025-05-14T08:30:00+07:00")).toBe(
      "14/05/2025 08:30",
    );
  });
});

describe("formatPercent", () => {
  it("formats with one decimal and a comma", () => {
    expect(formatPercent(12.345)).toBe("12,3%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0,0%");
  });
});

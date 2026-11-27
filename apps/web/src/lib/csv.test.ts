import { describe, expect, it } from "vitest";

import { escapeCsvCell } from "./csv";

describe("escapeCsvCell", () => {
  it("neutralizes spreadsheet formula prefixes", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell("+1+1")).toBe("'+1+1");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("quotes commas, quotes, and newlines", () => {
    expect(escapeCsvCell('Beras "Premium", 5kg')).toBe(
      '"Beras ""Premium"", 5kg"',
    );
    expect(escapeCsvCell("baris\nbaru")).toBe('"baris\nbaru"');
  });

  it("leaves plain values and numbers unchanged", () => {
    expect(escapeCsvCell("Beras")).toBe("Beras");
    expect(escapeCsvCell(258500)).toBe("258500");
    expect(escapeCsvCell(-2)).toBe("-2");
  });
});

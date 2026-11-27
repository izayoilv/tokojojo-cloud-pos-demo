import { describe, expect, it } from "vitest";

import { isDueSoon } from "./date";

const now = new Date("2026-11-27T10:00:00+07:00");

describe("isDueSoon", () => {
  it("includes due dates within the window and overdue dates", () => {
    expect(isDueSoon("2026-11-27", now)).toBe(true);
    expect(isDueSoon("2026-12-04", now)).toBe(true);
    expect(isDueSoon("2026-11-20", now)).toBe(true);
  });

  it("excludes dates beyond the window", () => {
    expect(isDueSoon("2026-12-05", now)).toBe(false);
  });

  it("rejects invalid dates", () => {
    expect(isDueSoon("bukan-tanggal", now)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  assignableRoles,
  canAccess,
  canAssignRole,
  canReviewOpname,
  canViewSales,
} from "./rbac";

describe("stock opname review", () => {
  it("only allows OWNER and ADMIN to review", () => {
    expect(canReviewOpname("OWNER")).toBe(true);
    expect(canReviewOpname("ADMIN")).toBe(true);
    expect(canReviewOpname("CASHIER")).toBe(false);
    expect(canReviewOpname("WAREHOUSE")).toBe(false);
  });
});

describe("role assignment", () => {
  it("only OWNER can assign OWNER", () => {
    expect(canAssignRole("OWNER", "OWNER")).toBe(true);
    expect(canAssignRole("ADMIN", "OWNER")).toBe(false);
    expect(canAssignRole("ADMIN", "ADMIN")).toBe(true);
    expect(canAssignRole("ADMIN", "CASHIER")).toBe(true);
  });

  it("removes OWNER from the ADMIN selector", () => {
    expect(assignableRoles("OWNER")).toContain("OWNER");
    expect(assignableRoles("ADMIN")).not.toContain("OWNER");
    expect(assignableRoles("ADMIN")).toEqual(["ADMIN", "CASHIER", "WAREHOUSE"]);
  });
});

describe("dashboard visibility", () => {
  it("hides sales from WAREHOUSE", () => {
    expect(canViewSales("OWNER")).toBe(true);
    expect(canViewSales("ADMIN")).toBe(true);
    expect(canViewSales("CASHIER")).toBe(true);
    expect(canViewSales("WAREHOUSE")).toBe(false);
    expect(canAccess("WAREHOUSE", "PENJUALAN")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { repository } from "./repository";

describe("repository.login", () => {
  it("signs in a demo owner with the seeded password", async () => {
    const user = await repository.login("owner", "tokojojo123");
    expect(user.role).toBe("OWNER");
    expect(user.name).toBe("Ko Jojo Halim");
  });

  it("rejects a wrong password", async () => {
    await expect(repository.login("owner", "salah")).rejects.toThrow(
      "Nama pengguna atau kata sandi salah",
    );
  });
});

describe("repository.listProducts", () => {
  it("returns the twelve seeded SKUs with integer money", async () => {
    const products = await repository.listProducts();
    expect(products).toHaveLength(12);
    expect(products.every((product) => Number.isInteger(product.cost))).toBe(
      true,
    );
    expect(products.every((product) => Number.isInteger(product.price))).toBe(
      true,
    );
  });
});

describe("repository.listUsers", () => {
  it("returns one user per demo role", async () => {
    const users = await repository.listUsers();
    expect(users.map((user) => user.role).sort()).toEqual([
      "ADMIN",
      "CASHIER",
      "OWNER",
      "WAREHOUSE",
    ]);
  });
});

describe("repository reads", () => {
  it("exposes sales, transfers, and store settings", async () => {
    const [sales, transfers, settings] = await Promise.all([
      repository.listSales(),
      repository.listTransfers(),
      repository.getSettings(),
    ]);

    expect(sales.length).toBeGreaterThanOrEqual(10);
    expect(sales[0]?.items.length).toBeGreaterThan(0);
    expect(transfers.some((transfer) => transfer.status === "PENDING")).toBe(
      true,
    );
    expect(settings.name).toBe("TOKO JOJO");
  });
});

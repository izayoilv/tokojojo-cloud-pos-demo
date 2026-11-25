import { describe, expect, it } from "vitest";

import { products } from "../data/mock";
import { createPosStore } from "./store";

const unlockedStore = () => {
  const store = createPosStore();
  store.actions.approveDevice();
  store.actions.unlockPin("4321");
  store.actions.openShift(500000);
  return store;
};

describe("device enrollment", () => {
  it("starts at enrollment and unlocks after device approval", () => {
    const store = createPosStore();
    expect(store.state.screen()).toBe("ENROLLMENT");

    store.actions.approveDevice();
    expect(store.state.screen()).toBe("LOCK");
    expect(store.state.deviceStatus()).toBe("ACTIVE");
  });

  it("returns to enrollment when the device is revoked", () => {
    const store = createPosStore();
    store.actions.approveDevice();
    store.actions.setDeviceStatus("REVOKED");
    expect(store.state.screen()).toBe("ENROLLMENT");
    expect(store.state.deviceStatus()).toBe("REVOKED");
  });
});

describe("PIN unlock", () => {
  it("rejects a wrong PIN and accepts the demo PIN", () => {
    const store = createPosStore();
    store.actions.approveDevice();

    store.actions.unlockPin("1111");
    expect(store.state.pinError()).toBe("PIN salah");
    expect(store.state.screen()).toBe("LOCK");

    store.actions.unlockPin("4321");
    expect(store.state.screen()).toBe("OPEN_SHIFT");
    expect(store.state.session()?.name).toBe("Dewi Lestari");
  });

  it("locks out after five failed attempts", () => {
    const store = createPosStore();
    store.actions.approveDevice();
    for (let attempt = 0; attempt < 5; attempt++) {
      store.actions.unlockPin("0000");
    }

    expect(store.state.pinError()).toContain("5 menit");
    store.actions.unlockPin("4321");
    expect(store.state.screen()).toBe("LOCK");
  });
});

describe("shift and cart", () => {
  it("opens a shift with the reference cart", () => {
    const store = unlockedStore();
    expect(store.state.screen()).toBe("SELL");
    expect(store.state.shift()?.openingCash).toBe(500000);
    expect(store.state.totals().total).toBe(166500);
    expect(store.state.totals().itemCount).toBe(3);
  });

  it("cannot complete a sale with an empty cart", () => {
    const store = unlockedStore();
    const previousSales = store.state.sales().length;
    store.actions.clearCart();
    store.actions.selectPaymentMethod("TUNAI");
    store.actions.setCashReceived(200000);
    store.actions.completeSale();

    expect(store.state.error()).toContain("Keranjang");
    expect(store.state.sales()).toHaveLength(previousSales);
  });

  it("opens a multi-unit product with the selected unit price", () => {
    const store = unlockedStore();
    store.actions.clearCart();
    store.actions.addProduct("PRD-003", "PU-006");
    expect(store.state.totals().total).toBe(138000);
    expect(store.state.cart()[0]?.unitName).toBe("Dus");
  });

  it("holds and recalls a cart", () => {
    const store = unlockedStore();
    const total = store.state.totals().total;
    store.actions.holdCart();
    expect(store.state.cart()).toHaveLength(0);
    expect(store.state.heldCarts()).toHaveLength(2);

    const held = store.state.heldCarts().at(-1)!;
    store.actions.recallCart(held.id);
    expect(store.state.totals().total).toBe(total);
  });
});

describe("payment and offline behavior", () => {
  it("blocks non-cash payments while offline and queues the cash sale", () => {
    const store = unlockedStore();
    store.actions.setConnection("OFFLINE");

    store.actions.selectPaymentMethod("QRIS");
    expect(store.state.error()).toContain("hanya tunai");

    store.actions.selectPaymentMethod("TUNAI");
    store.actions.setCashReceived(200000);
    store.actions.completeSale();

    expect(store.state.screen()).toBe("RECEIPT");
    expect(store.state.receipt()?.total).toBe(166500);
    expect(store.state.queue().pending).toBe(1);
    expect(store.state.receipt()?.change).toBe(33500);
  });

  it("rejects cash below the total", () => {
    const store = unlockedStore();
    store.actions.selectPaymentMethod("TUNAI");
    store.actions.setCashReceived(100000);
    store.actions.completeSale();

    expect(store.state.error()).toContain("kurang");
    expect(store.state.screen()).toBe("SELL");
  });

  it("keeps a non-cash payment reference on the sale", () => {
    const store = unlockedStore();
    store.actions.selectPaymentMethod("DEBIT");
    store.actions.setPaymentReference("EDC-7781");
    store.actions.completeSale();

    expect(store.state.receipt()?.payments[0]?.reference).toBe("EDC-7781");
  });

  it("keeps receipt prices stable when catalogue prices change", () => {
    const store = unlockedStore();
    const product = products.find((item) => item.id === "PRD-001")!;
    const unit = product.units[0]!;
    const originalPrice = unit.sellingPrice;

    try {
      store.actions.selectPaymentMethod("TUNAI");
      store.actions.setCashReceived(200000);
      store.actions.completeSale();

      const receipt = store.state.receipt()!;
      const line = receipt.items.find((item) => item.productId === product.id)!;
      const receiptPrice = line.unitPrice;

      unit.sellingPrice = 999999;

      expect(
        store.state
          .receipt()!
          .items.find((item) => item.productId === product.id)!.unitPrice,
      ).toBe(receiptPrice);
      expect(store.state.receipt()!.total).toBe(receipt.total);
    } finally {
      unit.sellingPrice = originalPrice;
    }
  });

  it("closes the shift with a zero difference when cash matches", () => {
    const store = unlockedStore();
    store.actions.setConnection("OFFLINE");
    store.actions.selectPaymentMethod("TUNAI");
    store.actions.setCashReceived(200000);
    store.actions.completeSale();
    store.actions.closeShift(666500);

    expect(store.state.shift()?.status).toBe("CLOSED");
    expect(store.state.shift()?.difference).toBe(0);
    expect(store.state.screen()).toBe("LOCK");
  });
});

describe("sales history actions", () => {
  it("blocks returns and voids while offline", () => {
    const store = unlockedStore();
    const target = store.state
      .sales()
      .find((sale) => sale.status === "COMPLETED")!;
    store.actions.setConnection("OFFLINE");

    store.actions.voidSale(target.id);
    expect(store.state.error()).toContain("koneksi online");
    expect(
      store.state.sales().find((sale) => sale.id === target.id)?.status,
    ).toBe("COMPLETED");

    store.actions.returnSale(target.id);
    expect(
      store.state.sales().find((sale) => sale.id === target.id)?.status,
    ).toBe("COMPLETED");
  });

  it("requires admin or owner and updates completed sales online", () => {
    const store = unlockedStore();
    const completed = store.state
      .sales()
      .filter((sale) => sale.status === "COMPLETED");
    const first = completed[0]!;
    const second = completed[1]!;

    store.actions.voidSale(first.id);
    expect(store.state.error()).toContain("ADMIN/OWNER");
    expect(
      store.state.sales().find((sale) => sale.id === first.id)?.status,
    ).toBe("COMPLETED");

    store.actions.setSessionRole("OWNER");
    store.actions.voidSale(first.id);
    expect(
      store.state.sales().find((sale) => sale.id === first.id)?.status,
    ).toBe("VOIDED");

    store.actions.returnSale(second.id);
    expect(
      store.state.sales().find((sale) => sale.id === second.id)?.status,
    ).toBe("PARTIAL_RETURN");

    store.actions.voidSale("SALE-003");
    expect(store.state.error()).toContain("tidak dapat diubah");
    expect(
      store.state.sales().find((sale) => sale.id === "SALE-003")?.status,
    ).toBe("PARTIAL_RETURN");
  });
});

describe("connection states", () => {
  it("enters hard lock without losing the queued sale", () => {
    const store = unlockedStore();
    const previousSales = store.state.sales().length;
    store.actions.setConnection("LOCKED");

    expect(store.state.screen()).toBe("HARD_LOCK");
    expect(store.state.paymentMethods()).toEqual([]);
    store.actions.completeSale();
    expect(store.state.sales()).toHaveLength(previousSales);
  });

  it("returns to sell after online recovery", () => {
    const store = unlockedStore();
    store.actions.setConnection("LOCKED");
    store.actions.setConnection("ONLINE");
    expect(store.state.screen()).toBe("SELL");
  });
});

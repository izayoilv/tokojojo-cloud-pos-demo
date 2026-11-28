import { describe, expect, it, vi } from "vitest";

import { demoUsers, products } from "../data/mock";
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

  it("expires the PIN lockout after five minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T10:00:00+07:00"));

    try {
      const store = createPosStore();
      store.actions.approveDevice();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        store.actions.unlockPin("1111");
      }

      expect(store.state.pinLockedUntil()).not.toBeNull();
      expect(store.state.screen()).toBe("LOCK");

      vi.advanceTimersByTime(5 * 60_000 + 1_000);
      store.actions.unlockPin("4321");

      expect(store.state.pinError()).toBeNull();
      expect(store.state.screen()).toBe("OPEN_SHIFT");
    } finally {
      vi.useRealTimers();
    }
  });

  it("switches the demo user before unlocking", () => {
    const store = createPosStore();
    store.actions.approveDevice();
    store.actions.selectUser(demoUsers[2]!);
    store.actions.unlockPin("4321");

    expect(store.state.session()?.role).toBe("OWNER");
    expect(store.state.session()?.name).toBe("Ko Jojo Halim");
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

describe("session and shift gates", () => {
  it("requires a session and an open shift before selling", () => {
    const store = createPosStore();
    const salesBefore = store.state.sales().length;
    store.actions.approveDevice();

    store.actions.go("SELL");
    expect(store.state.screen()).toBe("LOCK");
    expect(store.state.error()).toContain("Sesi");

    store.actions.unlockPin("4321");
    expect(store.state.screen()).toBe("OPEN_SHIFT");

    store.actions.addProduct("PRD-003", "PU-005");
    store.actions.selectPaymentMethod("TUNAI");
    store.actions.setCashReceived(200000);
    store.actions.completeSale();

    expect(store.state.error()).toContain("shift");
    expect(store.state.sales()).toHaveLength(salesBefore);
    expect(store.state.screen()).toBe("OPEN_SHIFT");

    store.actions.openShift(500000);
    store.actions.selectPaymentMethod("TUNAI");
    store.actions.setCashReceived(200000);
    store.actions.completeSale();

    expect(store.state.receipt()).not.toBeNull();
    expect(store.state.receipt()?.shiftId).toBe("SHIFT-02");
  });

  it("routes hard-lock recovery to lock when the session is gone", () => {
    const store = unlockedStore();
    store.actions.setConnection("LOCKED");
    store.actions.lock();
    expect(store.state.screen()).toBe("HARD_LOCK");

    store.actions.setConnection("ONLINE");
    expect(store.state.screen()).toBe("LOCK");
    expect(store.state.session()).toBeNull();
  });

  it("returns pending and revoked devices to enrollment after hard lock", () => {
    const store = createPosStore();
    expect(store.state.device().status).toBe("PENDING");

    store.actions.setConnection("LOCKED");
    store.actions.setConnection("ONLINE");
    expect(store.state.screen()).toBe("ENROLLMENT");

    store.actions.setDeviceStatus("REVOKED");
    store.actions.setConnection("LOCKED");
    expect(store.state.screen()).toBe("HARD_LOCK");
    store.actions.setConnection("ONLINE");
    expect(store.state.screen()).toBe("ENROLLMENT");
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

  it("requires a reference for non-cash and records the debt customer", () => {
    const store = unlockedStore();
    store.actions.selectPaymentMethod("QRIS");
    store.actions.completeSale();

    expect(store.state.error()).toContain("Referensi");
    expect(store.state.receipt()).toBeNull();

    store.actions.setPaymentReference("QRIS-9911");
    store.actions.completeSale();
    expect(store.state.receipt()?.payments[0]?.reference).toBe("QRIS-9911");

    const debt = unlockedStore();
    debt.actions.selectPaymentMethod("HUTANG");
    debt.actions.setPaymentReference("Warung Bu Sari");
    debt.actions.completeSale();

    expect(debt.state.receipt()?.customer).toBe("Warung Bu Sari");
  });

  it("records grace shifts as offline", () => {
    const store = createPosStore();
    store.actions.approveDevice();
    store.actions.unlockPin("4321");
    store.actions.setConnection("GRACE");
    store.actions.openShift(100000);

    expect(store.state.shift()?.source).toBe("OFFLINE");
  });

  it("blocks quantities above available stock", () => {
    const store = unlockedStore();
    store.actions.clearCart();
    const product = products.find((item) => item.id === "PRD-003")!;
    const unit = product.units[0]!;

    store.actions.addProduct(product.id, unit.id);
    store.actions.setQuantity("LINE-1", product.stock + 1);

    expect(store.state.cart()[0]?.quantity).toBe(1);
    expect(store.state.error()).toContain("Stok");
    expect(store.state.totals().itemCount).toBe(1);
  });

  it("records split tender with cash and non-cash components", () => {
    const store = unlockedStore();
    store.actions.selectPaymentMethod("CAMPURAN");
    store.actions.setSplitMethod("QRIS");
    store.actions.setSplitCash(100000);
    store.actions.setPaymentReference("QRIS-SPLIT-1");
    store.actions.completeSale();

    const sale = store.state.receipt()!;
    expect(sale.payments).toEqual([
      { method: "TUNAI", amount: 100000 },
      {
        method: "QRIS",
        amount: 66500,
        reference: "QRIS-SPLIT-1",
      },
    ]);
    expect(sale.change).toBe(0);
    expect(store.state.shift()?.cashSales).toBe(100000);
  });

  it("records a Hutang sale without treating it as paid", () => {
    const store = unlockedStore();
    store.actions.selectPaymentMethod("HUTANG");
    store.actions.setPaymentReference("Warung Bu Sari");
    store.actions.completeSale();

    const sale = store.state.receipt()!;
    expect(sale.customer).toBe("Warung Bu Sari");
    expect(sale.outstanding).toBe(166500);
    expect(sale.payments).toHaveLength(0);
    expect(store.state.shift()?.cashSales).toBe(0);
  });

  it("flags grace sales in the sync queue", () => {
    const store = unlockedStore();
    const flaggedBefore = store.state.queue().flagged;
    store.actions.setConnection("GRACE");
    store.actions.selectPaymentMethod("TUNAI");
    store.actions.setCashReceived(200000);
    store.actions.completeSale();

    expect(store.state.queue().pending).toBe(1);
    expect(store.state.queue().flagged).toBe(flaggedBefore + 1);
    expect(store.state.receipt()?.flaggedForReview).toBe(true);
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

  it("rejects voiding a paid sale", () => {
    const store = unlockedStore();
    store.actions.selectPaymentMethod("TUNAI");
    store.actions.setCashReceived(200000);
    store.actions.completeSale();

    const sale = store.state.receipt()!;
    store.actions.setSessionRole("OWNER");
    store.actions.voidSale(sale.id);

    expect(store.state.error()).toContain("tanpa pembayaran");
    expect(
      store.state.sales().find((item) => item.id === sale.id)?.status,
    ).toBe("COMPLETED");
    expect(store.state.shift()?.refunds).toBe(0);
  });

  it("charges cross-shift cash refunds to the active shift", () => {
    const store = unlockedStore();
    store.actions.setSessionRole("OWNER");

    store.actions.returnSale("SALE-001", 31000);
    expect(store.state.shift()?.refunds).toBe(31000);
    expect(
      store.state.sales().find((sale) => sale.id === "SALE-001")
        ?.refundedAmount,
    ).toBe(31000);

    store.actions.returnSale("SALE-002", 52000);
    expect(store.state.shift()?.refunds).toBe(31000);
    expect(
      store.state.sales().find((sale) => sale.id === "SALE-002")?.status,
    ).toBe("PARTIAL_RETURN");

    store.actions.closeShift(469000);
    const closed = store.state.shift()!;
    expect(closed.expectedCash).toBe(469000);
    expect(closed.difference).toBe(0);
  });

  it("requires an open shift for returns", () => {
    const store = createPosStore();
    store.actions.approveDevice();
    store.actions.unlockPin("4321");
    store.actions.setSessionRole("OWNER");

    store.actions.returnSale("SALE-001", 31000);

    expect(store.state.error()).toContain("Buka shift");
    expect(
      store.state.sales().find((sale) => sale.id === "SALE-001")?.status,
    ).toBe("COMPLETED");
  });

  it("records partial return refunds in shift cash", () => {
    const store = unlockedStore();
    store.actions.selectPaymentMethod("TUNAI");
    store.actions.setCashReceived(200000);
    store.actions.completeSale();

    const sale = store.state.receipt()!;
    store.actions.setSessionRole("OWNER");

    store.actions.returnSale(sale.id, 200000);
    expect(store.state.error()).toContain("tidak valid");
    expect(
      store.state.sales().find((item) => item.id === sale.id)?.status,
    ).toBe("COMPLETED");

    store.actions.returnSale(sale.id, 50000);
    expect(store.state.shift()?.refunds).toBe(50000);
    expect(
      store.state.sales().find((item) => item.id === sale.id)?.status,
    ).toBe("PARTIAL_RETURN");

    store.actions.closeShift(616500);

    const closed = store.state.shift()!;
    expect(closed.expectedCash).toBe(616500);
    expect(closed.difference).toBe(0);
  });

  it("requires admin or owner and rejects paid voids", () => {
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
    expect(store.state.error()).toContain("tanpa pembayaran");
    expect(
      store.state.sales().find((sale) => sale.id === first.id)?.status,
    ).toBe("COMPLETED");

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

  it("syncs queued offline sales when online", () => {
    const store = unlockedStore();
    const acceptedBefore = store.state.queue().accepted;

    store.actions.setConnection("OFFLINE");
    store.actions.selectPaymentMethod("TUNAI");
    store.actions.setCashReceived(200000);
    store.actions.completeSale();
    expect(store.state.queue().pending).toBe(1);

    store.actions.syncNow();
    expect(store.state.error()).toContain("online");

    store.actions.setConnection("ONLINE");
    store.actions.syncNow();

    expect(store.state.queue().pending).toBe(0);
    expect(store.state.queue().accepted).toBe(acceptedBefore + 1);
    expect(store.state.queue().lastSync).toContain("WIB");
  });

  it("keeps history available under hard lock without allowing sales", () => {
    const store = unlockedStore();
    const salesBefore = store.state.sales().length;

    store.actions.setConnection("LOCKED");
    expect(store.state.screen()).toBe("HARD_LOCK");

    store.actions.go("HISTORY");
    expect(store.state.screen()).toBe("HISTORY");

    store.actions.completeSale();
    expect(store.state.sales()).toHaveLength(salesBefore);

    store.actions.lock();
    expect(store.state.screen()).toBe("HARD_LOCK");

    store.actions.unlockPin("4321");
    expect(store.state.screen()).toBe("HARD_LOCK");

    store.actions.setConnection("ONLINE");
    expect(store.state.screen()).toBe("LOCK");

    store.actions.unlockPin("4321");
    expect(store.state.screen()).toBe("SELL");
  });

  it("requires PIN re-authentication after online recovery", () => {
    const store = unlockedStore();
    store.actions.setConnection("LOCKED");
    store.actions.setConnection("ONLINE");

    expect(store.state.screen()).toBe("LOCK");

    store.actions.unlockPin("4321");
    expect(store.state.screen()).toBe("SELL");
  });

  it("does not leave hard lock for grace or offline states", () => {
    const store = unlockedStore();
    store.actions.setConnection("LOCKED");
    store.actions.setConnection("OFFLINE");
    expect(store.state.screen()).toBe("HARD_LOCK");

    store.actions.setConnection("LOCKED");
    store.actions.setConnection("GRACE");
    expect(store.state.screen()).toBe("HARD_LOCK");
  });
});

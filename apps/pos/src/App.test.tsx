// @vitest-environment happy-dom
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import App from "./App";
import { PosProvider } from "./app/PosProvider";
import { createPosStore } from "./app/store";

const click = (element: Element) => {
  element.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
  );
};

const findButton = (
  root: HTMLElement,
  label: string,
  scope: ParentNode = root,
) =>
  [...scope.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(label),
  );

const pressPin = (root: HTMLElement, pin: string) => {
  for (const digit of pin) {
    const button = root.querySelector<HTMLButtonElement>(
      `[data-pin-digit="${digit}"]`,
    );
    expect(button).not.toBeNull();
    click(button!);
  }
};

const openSell = (root: HTMLElement) => {
  click(findButton(root, "Setujui perangkat")!);
  pressPin(root, "4321");

  const input = root.querySelector<HTMLInputElement>(
    'input[inputmode="numeric"]',
  );
  expect(input).not.toBeNull();
  input!.value = "500000";
  input!.dispatchEvent(new Event("input", { bubbles: true }));

  click(findButton(root, "Buka shift")!);
};

let dispose: (() => void) | undefined;

function mount() {
  const root = document.createElement("div");
  document.body.append(root);
  const store = createPosStore();

  dispose = render(
    () => (
      <PosProvider store={store}>
        <App />
      </PosProvider>
    ),
    root,
  );

  return { root, store };
}

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
});

describe("app shell", () => {
  it("activates a pending device and reaches the PIN screen", () => {
    const { root, store } = mount();

    expect(root.textContent).toContain("Aktifkan perangkat");
    expect(root.textContent).toContain("Perangkat menunggu persetujuan admin.");
    expect(store.state.deviceStatus()).toBe("PENDING");

    const approve = findButton(root, "Setujui perangkat");
    expect(approve).toBeDefined();
    click(approve!);

    expect(store.state.deviceStatus()).toBe("ACTIVE");
    expect(root.textContent).toContain("Masukkan PIN");
  });

  it("rejects a wrong PIN then opens a shift with opening cash", () => {
    const { root, store } = mount();

    click(findButton(root, "Setujui perangkat")!);
    pressPin(root, "1111");

    expect(root.textContent).toContain("PIN salah");
    expect(store.state.screen()).toBe("LOCK");

    pressPin(root, "4321");

    expect(root.textContent).toContain("Buka Shift");
    expect(store.state.screen()).toBe("OPEN_SHIFT");

    const input = root.querySelector<HTMLInputElement>(
      'input[inputmode="numeric"]',
    );
    expect(input).not.toBeNull();
    input!.value = "500000";
    input!.dispatchEvent(new Event("input", { bubbles: true }));

    click(findButton(root, "Buka shift")!);

    expect(store.state.screen()).toBe("SELL");
    expect(store.state.shift()?.openingCash).toBe(500000);
    expect(store.state.cart()).toHaveLength(3);
  });

  it("adds a multi-unit product and holds and recalls the cart", () => {
    const { root, store } = mount();
    openSell(root);

    expect(root.textContent).toContain("Transaksi Aktif");
    expect(root.textContent).toContain("Rp 166.500");

    const indomie = findButton(root, "Indomie Goreng Spesial");
    expect(indomie).toBeDefined();
    click(indomie!);

    expect(root.textContent).toContain("Pilih satuan");
    const unitDialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(unitDialog).not.toBeNull();
    const dus = findButton(root, "Dus", unitDialog!);
    expect(dus).toBeDefined();
    click(dus!);

    expect(
      store.state
        .cart()
        .some(
          (line) => line.productId === "PRD-003" && line.unitName === "Dus",
        ),
    ).toBe(true);
    expect(store.state.totals().total).toBe(304500);

    click(findButton(root, "Tahan")!);
    expect(store.state.cart()).toHaveLength(0);
    expect(store.state.heldCarts()).toHaveLength(2);

    click(findButton(root, "Panggil")!);
    const held = findButton(root, "Pesanan #2", document);
    expect(held).toBeDefined();
    click(held!);

    expect(store.state.totals().total).toBe(304500);
    expect(root.textContent).toContain("Rp 304.500");
  });

  it("pays cash with change and completes the sale", () => {
    const { root, store } = mount();
    openSell(root);

    click(findButton(root, "Bayar")!);

    expect(store.state.screen()).toBe("PAYMENT");
    expect(root.textContent).toContain("Total tagihan");
    expect(root.textContent).toContain("Rp 166.500");

    const quickAmount = findButton(root, "Rp 200.000");
    expect(quickAmount).toBeDefined();
    click(quickAmount!);

    expect(root.textContent).toContain("Rp 33.500");

    click(findButton(root, "Selesaikan & Cetak Struk")!);

    expect(store.state.screen()).toBe("RECEIPT");
    expect(store.state.receipt()?.change).toBe(33500);
  });

  it("disables non-cash methods while offline", () => {
    const { root, store } = mount();
    openSell(root);

    store.actions.setConnection("OFFLINE");
    click(findButton(root, "Bayar")!);

    expect(store.state.screen()).toBe("PAYMENT");
    expect(root.textContent).toContain(
      "Offline: hanya pembayaran tunai yang tersedia.",
    );

    const qris = findButton(root, "QRIS");
    expect(qris).toBeDefined();
    expect((qris as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps cash ready when the connection drops on the payment screen", () => {
    const { root, store } = mount();
    openSell(root);
    click(findButton(root, "Bayar")!);

    store.actions.setConnection("OFFLINE");

    expect(store.state.paymentMethod()).toBe("TUNAI");
    expect(store.state.cashReceived()).toBe(166500);
    expect((findButton(root, "QRIS") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a receipt snapshot and starts a new transaction", () => {
    const { root, store } = mount();
    openSell(root);

    click(findButton(root, "Bayar")!);
    click(findButton(root, "Rp 200.000")!);
    click(findButton(root, "Selesaikan & Cetak Struk")!);

    expect(store.state.screen()).toBe("RECEIPT");
    expect(root.textContent).toContain("Pembayaran berhasil");
    expect(root.textContent).toContain("INV/");
    expect(root.textContent).toContain("Dewi Lestari");
    expect(root.textContent).toContain("Bungkus");
    expect(root.textContent).toContain("Rp 166.500");
    expect(root.textContent).toContain("Tunai");
    expect(root.textContent).toContain("Rp 33.500");

    click(findButton(root, "Transaksi Baru")!);

    expect(store.state.screen()).toBe("SELL");
    expect(store.state.receipt()).toBeNull();
    expect(store.state.cart()).toHaveLength(0);
  });

  it("shows sales history, reprint, and blocks returns offline", () => {
    const { root, store } = mount();
    openSell(root);
    click(findButton(root, "Riwayat")!);

    expect(store.state.screen()).toBe("HISTORY");
    expect(root.textContent).toContain("Riwayat Transaksi");
    expect(root.textContent).toContain("Retur sebagian");
    expect(
      root.querySelectorAll<HTMLElement>("[data-sale-id]")[0]?.dataset.saleId,
    ).toBe("SALE-001");

    const completed = root.querySelector<HTMLButtonElement>(
      '[data-sale-id="SALE-001"]',
    );
    expect(completed).not.toBeNull();
    click(completed!);

    expect(root.textContent).toContain(
      "Hanya ADMIN/OWNER yang dapat memproses retur/void.",
    );

    click(findButton(root, "Cetak")!);
    expect(document.body.textContent).toContain("Cetak ulang struk");
    expect(document.body.textContent).toContain("TOKO JOJO");

    click(findButton(root, "Cetak struk", document)!);
    expect(root.textContent).toContain("Struk dikirim ke printer demo.");

    store.actions.setConnection("OFFLINE");
    expect(root.textContent).toContain(
      "Retur/void membutuhkan koneksi online.",
    );
  });

  it("voids a sale with demo owner permission", () => {
    const { root, store } = mount();
    openSell(root);
    click(findButton(root, "Riwayat")!);

    const completed = root.querySelector<HTMLButtonElement>(
      '[data-sale-id="SALE-001"]',
    );
    expect(completed).not.toBeNull();
    click(completed!);

    click(findButton(root, "Aktifkan izin demo OWNER")!);
    expect(store.state.session()?.role).toBe("OWNER");

    const voidButton = root.querySelector<HTMLButtonElement>(
      '[data-action="void"]',
    );
    expect(voidButton).not.toBeNull();
    expect(voidButton!.disabled).toBe(false);
    click(voidButton!);
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const confirm = findButton(root, "Void", dialog!);
    expect(confirm).toBeDefined();
    click(confirm!);

    expect(
      store.state.sales().find((sale) => sale.id === "SALE-001")?.status,
    ).toBe("VOIDED");
    expect(root.textContent).toContain(
      "Transaksi void. Audit void tersimpan pada log.",
    );
  });

  it("shows revoked copy and retries back to pending", () => {
    const { root, store } = mount();

    const revoke = findButton(root, "Cabut");
    expect(revoke).toBeDefined();
    click(revoke!);

    expect(store.state.deviceStatus()).toBe("REVOKED");
    expect(root.textContent).toContain("Perangkat dicabut. Hubungi admin.");

    const retry = findButton(root, "Coba lagi");
    expect(retry).toBeDefined();
    click(retry!);

    expect(store.state.deviceStatus()).toBe("PENDING");
    expect(root.textContent).toContain("Perangkat menunggu persetujuan admin.");
  });
});

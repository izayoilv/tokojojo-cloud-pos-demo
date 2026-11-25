// @vitest-environment happy-dom
import { PreferencesProvider, ToastProvider } from "@tokojojo/ui";
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
      <PreferencesProvider defaultTheme="light">
        <ToastProvider>
          <PosProvider store={store}>
            <App />
          </PosProvider>
        </ToastProvider>
      </PreferencesProvider>
    ),
    root,
  );

  return { root, store };
}

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
  window.localStorage.clear();
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

    const closeDetail = root.querySelector<HTMLButtonElement>(
      '[aria-label="Tutup detail"]',
    );
    expect(closeDetail).not.toBeNull();
    click(closeDetail!);
    expect(root.textContent).toContain("Pilih transaksi");
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
    expect(dialog!.textContent).toContain("Void tunai mengembalikan Rp 31.000");
    expect(dialog!.textContent).toContain("shift lain");

    const confirm = findButton(root, "Void", dialog!);
    expect(confirm).toBeDefined();
    click(confirm!);

    expect(
      store.state.sales().find((sale) => sale.id === "SALE-001")?.status,
    ).toBe("VOIDED");
    expect(root.textContent).toContain(
      "Transaksi void. Audit void tersimpan pada log.",
    );

    click(findButton(root, "Cetak")!);
    expect(document.body.textContent).toContain("VOID · STRUK TIDAK SAH");
  });

  it("explains non-cash returns without a cash-drawer effect", () => {
    const { root } = mount();
    openSell(root);
    click(findButton(root, "Riwayat")!);

    const nonCash = root.querySelector<HTMLButtonElement>(
      '[data-sale-id="SALE-002"]',
    );
    expect(nonCash).not.toBeNull();
    click(nonCash!);

    click(findButton(root, "Aktifkan izin demo OWNER")!);
    const returnButton = root.querySelector<HTMLButtonElement>(
      '[data-action="return"]',
    );
    expect(returnButton).not.toBeNull();
    click(returnButton!);

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain(
      "Tandai transaksi sebagai retur dan catat jumlah refund.",
    );
    expect(dialog!.textContent).toContain("tidak mengurangi kas fisik");
    expect(dialog!.textContent).not.toContain("refund tunai yang dikembalikan");
  });

  it("closes a shift with a cash difference", () => {
    const { root, store } = mount();
    openSell(root);

    const openClose = root.querySelector<HTMLButtonElement>(
      '[data-action="open-close-shift"]',
    );
    expect(openClose).not.toBeNull();
    click(openClose!);

    expect(store.state.screen()).toBe("CLOSE_SHIFT");
    expect(root.textContent).toContain("Uang seharusnya");
    expect(root.textContent).toContain("Rp 500.000");

    const actual = root.querySelector<HTMLInputElement>("#actual-cash");
    expect(actual).not.toBeNull();
    actual!.value = "490000";
    actual!.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.textContent).toContain("-Rp 10.000");

    const close = root.querySelector<HTMLButtonElement>(
      '[data-action="close-shift"]',
    );
    expect(close).not.toBeNull();
    click(close!);

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const confirm = document.querySelector<HTMLButtonElement>(
      '[data-action="confirm-close-shift"]',
    );
    expect(confirm).not.toBeNull();
    click(confirm!);

    expect(store.state.shift()?.status).toBe("CLOSED");
    expect(store.state.shift()?.difference).toBe(-10000);
    expect(store.state.screen()).toBe("LOCK");
  });

  it("shows the offline banner and sync diagnostics", () => {
    const { root, store } = mount();
    openSell(root);

    store.actions.setConnection("OFFLINE");
    expect(root.textContent).toContain("Offline · 0 transaksi dalam antrean");

    click(findButton(root, "Sinkronisasi")!);
    expect(store.state.screen()).toBe("SYNC");
    expect(root.textContent).toContain("Antrean transaksi offline");

    const offlineSync = findButton(root, "Sinkron sekarang");
    expect(offlineSync).toBeDefined();
    expect((offlineSync as HTMLButtonElement).disabled).toBe(true);

    const goOnline = root.querySelector<HTMLButtonElement>(
      '[data-connection="ONLINE"]',
    );
    expect(goOnline).not.toBeNull();
    click(goOnline!);

    const onlineSync = findButton(root, "Sinkron sekarang");
    expect((onlineSync as HTMLButtonElement).disabled).toBe(false);
    click(onlineSync!);

    expect(root.textContent).toContain(
      "Tidak ada antrean. Waktu sinkron diperbarui.",
    );
  });

  it("shows hard lock, keeps history accessible, and recovers online", () => {
    const { root, store } = mount();
    openSell(root);

    store.actions.setConnection("LOCKED");
    expect(store.state.screen()).toBe("HARD_LOCK");
    expect(root.textContent).toContain("POS terkunci");
    expect(root.textContent).toContain("Penjualan baru diblokir");

    click(findButton(root, "Lihat riwayat")!);
    expect(store.state.screen()).toBe("HISTORY");
    expect(findButton(root, "Kembali ke layar terkunci")).toBeDefined();

    click(findButton(root, "Kembali ke layar terkunci")!);
    expect(store.state.screen()).toBe("HARD_LOCK");

    click(findButton(root, "Coba online")!);
    expect(store.state.connection()).toBe("ONLINE");
    expect(store.state.screen()).toBe("SELL");
  });

  it("opens settings and applies display, printer, and PIN changes", () => {
    const { root, store } = mount();
    openSell(root);

    const openSettings = root.querySelector<HTMLButtonElement>(
      '[aria-label="Pengaturan"]',
    );
    expect(openSettings).not.toBeNull();
    click(openSettings!);

    expect(store.state.screen()).toBe("SETTINGS");
    expect(root.textContent).toContain("Printer & Struk");
    expect(root.textContent).toContain("Pintasan");
    expect(root.textContent).toContain("Keamanan");
    expect(root.textContent).toContain("Perangkat & Sinkronisasi");
    expect(root.textContent).toContain("Tentang");

    click(findButton(root, "Gelap")!);
    expect(document.documentElement.dataset.theme).toBe("dark");

    click(findButton(root, "Besar")!);
    expect(document.documentElement.dataset.textSize).toBe("large");

    click(findButton(root, "58 mm")!);
    expect(store.state.settings().paperSize).toBe("58mm");

    const autoPrint = root.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(autoPrint).not.toBeNull();
    autoPrint!.click();
    expect(store.state.settings().autoPrint).toBe(true);

    click(findButton(root, "Ubah PIN")!);
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const setPin = (selector: string, value: string) => {
      const input = dialog!.querySelector<HTMLInputElement>(selector);
      expect(input).not.toBeNull();
      input!.value = value;
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    };

    setPin("#current-pin", "4321");
    setPin("#new-pin", "1111");
    setPin("#confirm-pin", "1111");
    click(findButton(root, "Simpan PIN", dialog!)!);

    expect(store.state.settings().localPin).toBe("1111");
    expect(root.textContent).toContain("PIN lokal diperbarui");

    store.actions.lock();
    store.actions.unlockPin("4321");
    expect(store.state.pinError()).toBe("PIN salah");
    store.actions.unlockPin("1111");
    expect(store.state.screen()).toBe("SELL");
  });

  it("supports keyboard shortcuts on the sell screen", () => {
    const { root, store } = mount();
    openSell(root);

    const search = root.querySelector<HTMLInputElement>(
      'input[aria-label="Cari produk"]',
    );
    expect(search).not.toBeNull();
    search!.blur();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F3", bubbles: true }),
    );
    expect(document.activeElement).toBe(search);

    search!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F2", bubbles: true }),
    );
    expect(store.state.screen()).toBe("PAYMENT");

    const cash = root.querySelector<HTMLInputElement>("#cash-received");
    expect(cash).not.toBeNull();
    cash!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F2", bubbles: true }),
    );
    expect(store.state.screen()).toBe("RECEIPT");

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(store.state.screen()).toBe("SELL");

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F9", bubbles: true }),
    );
    expect(store.state.screen()).toBe("HISTORY");

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(store.state.screen()).toBe("SELL");

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F12", bubbles: true }),
    );
    expect(store.state.screen()).toBe("LOCK");
  });

  it("does not restore selling after hard lock without a session", () => {
    const { root, store } = mount();
    openSell(root);

    store.actions.setConnection("LOCKED");
    store.actions.lock();
    expect(store.state.screen()).toBe("HARD_LOCK");
    expect(store.state.session()).toBeNull();

    click(findButton(root, "Coba online")!);

    expect(store.state.connection()).toBe("ONLINE");
    expect(store.state.screen()).toBe("LOCK");
    expect(root.textContent).toContain("Masukkan PIN");
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

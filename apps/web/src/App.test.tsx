// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import App from "./App";

const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const click = (element: Element) => {
  element.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
  );
};

let dispose: (() => void) | undefined;

function mount() {
  const root = document.createElement("div");
  document.body.append(root);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  dispose = render(
    () => (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    ),
    root,
  );
  return root;
}

function setInput(root: HTMLElement, selector: string, value: string) {
  const input = root.querySelector<HTMLInputElement>(selector);
  expect(input).not.toBeNull();
  input!.value = value;
  input!.dispatchEvent(new Event("input", { bubbles: true }));
}

async function login(root: HTMLElement, username: string) {
  await wait(30);
  setInput(root, 'input[autocomplete="username"]', username);
  setInput(root, 'input[autocomplete="current-password"]', "tokojojo123");
  root
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await wait(500);
}

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("app smoke", () => {
  it("starts the login form empty", async () => {
    const root = mount();
    await wait(30);
    const username = root.querySelector<HTMLInputElement>(
      'input[autocomplete="username"]',
    );
    const password = root.querySelector<HTMLInputElement>(
      'input[autocomplete="current-password"]',
    );

    expect(username?.value).toBe("");
    expect(password?.value).toBe("");
  });

  it("logs in, navigates to products, and opens reports", async () => {
    const root = mount();
    await login(root, "owner");

    expect(root.textContent).toContain("Ringkasan");
    expect(root.textContent).toContain("Tren penjualan");
    expect(root.textContent).toContain("Penjualan terbaru");

    const productLink = [...root.querySelectorAll("a")].find((link) =>
      link.textContent?.includes("Produk"),
    );
    expect(productLink).toBeDefined();
    click(productLink!);

    await wait(500);

    expect(root.textContent).toContain("Master Produk (12 aktif)");
    expect(root.textContent).toContain("Beras Setra Ramos");
    expect(root.textContent).toContain("Tambah Produk");

    const reportLink = [...root.querySelectorAll("a")].find((link) =>
      link.textContent?.includes("Laporan"),
    );
    expect(reportLink).toBeDefined();
    click(reportLink!);

    await wait(500);

    expect(root.textContent).toContain("Laporan");
    expect(root.textContent).toContain("Penjualan Harian / Mingguan / Bulanan");
  });

  it("navigates from an actionable stock notification", async () => {
    const root = mount();
    await login(root, "owner");

    const trigger = root.querySelector('button[aria-label="Notifikasi"]')!;
    trigger.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerType: "mouse",
      }),
    );
    await wait(100);

    const item = [
      ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((entry) => entry.textContent?.includes("Stok"));
    expect(item).toBeDefined();

    click(item!);
    await wait(200);

    expect(window.location.pathname).toBe("/persediaan");
  });

  it("archives and restores a product with confirmation", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/produk");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    const rowCheckbox = root.querySelector<HTMLInputElement>(
      'tbody input[type="checkbox"]',
    );
    expect(rowCheckbox).not.toBeNull();
    click(rowCheckbox!);
    await wait(30);

    click(
      [...root.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Arsipkan",
      )!,
    );
    await wait(50);

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain("Arsipkan produk?");
    click(
      [...dialog!.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Arsipkan",
      )!,
    );
    await wait(500);

    expect(root.textContent).toContain("11 aktif · 1 arsip");
    expect(root.textContent).not.toContain("Diarsipkan");

    const showArchived = [...root.querySelectorAll("label")]
      .find((label) => label.textContent?.includes("Tampilkan arsip"))
      ?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(showArchived).toBeDefined();
    click(showArchived!);
    await wait(100);

    expect(root.textContent).toContain("Diarsipkan");

    click(
      [...root.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Pulihkan",
      )!,
    );
    await wait(500);

    expect(root.textContent).toContain("12 aktif");
  });

  it("creates and cancels a purchase", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/pembelian");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    click(
      [...root.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Buat Pembelian"),
      )!,
    );
    await wait(100);

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const selects = dialog!.querySelectorAll<HTMLSelectElement>("select");
    selects[0]!.value = "CV Sumber Rejeki";
    selects[0]!.dispatchEvent(new Event("change", { bubbles: true }));
    selects[1]!.value = "PRD-001";
    selects[1]!.dispatchEvent(new Event("change", { bubbles: true }));

    const inputs = dialog!.querySelectorAll<HTMLInputElement>("input");
    inputs[0]!.value = "INV-UI-TEST";
    inputs[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    inputs[1]!.value = "2026-12-15";
    inputs[1]!.dispatchEvent(new Event("input", { bubbles: true }));

    click(
      [...dialog!.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Simpan pembelian",
      )!,
    );
    await wait(500);

    expect(root.textContent).toContain("INV-UI-TEST");

    const row = [...root.querySelectorAll("tr")].find((entry) =>
      entry.textContent?.includes("INV-UI-TEST"),
    );
    expect(row).toBeDefined();
    const cancelButton = [...row!.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Batalkan",
    );
    expect(cancelButton).toBeDefined();
    click(cancelButton!);
    await wait(50);

    const confirm = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(confirm!.textContent).toContain("Batalkan pembelian?");
    click(
      [...confirm!.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Batalkan",
      )!,
    );
    await wait(500);

    const cancelledRow = [...root.querySelectorAll("tr")].find((entry) =>
      entry.textContent?.includes("INV-UI-TEST"),
    );
    expect(cancelledRow?.textContent).toContain("CANCELLED");
  });

  it("validates warehouse transfers before creating", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/gudang");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    click(
      [...root.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Buat Mutasi"),
      )!,
    );
    await wait(100);

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const selects = dialog!.querySelectorAll<HTMLSelectElement>("select");
    selects[0]!.value = "WH-BACK";
    selects[0]!.dispatchEvent(new Event("change", { bubbles: true }));
    selects[1]!.value = "WH-BACK";
    selects[1]!.dispatchEvent(new Event("change", { bubbles: true }));
    selects[2]!.value = "PRD-001";
    selects[2]!.dispatchEvent(new Event("change", { bubbles: true }));

    click(
      [...dialog!.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Buat mutasi",
      )!,
    );
    await wait(100);

    expect(dialog!.textContent).toContain(
      "Lokasi asal dan tujuan harus berbeda.",
    );
  });

  it("creates an opname from counted stock", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/gudang");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    click(
      [...root.querySelectorAll('[role="tab"]')].find((tab) =>
        tab.textContent?.includes("Opname"),
      )!,
    );
    await wait(100);

    click(
      [...root.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Buat Opname"),
      )!,
    );
    await wait(100);

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const selects = dialog!.querySelectorAll<HTMLSelectElement>("select");
    selects[1]!.value = "PRD-002";
    selects[1]!.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(30);

    const systemStock = dialog!.textContent?.match(/Stok sistem: (\d+)/)?.[1];
    const physical = dialog!.querySelector<HTMLInputElement>(
      'input[type="number"]',
    );
    expect(systemStock).toBeDefined();
    expect(physical?.value).toBe(systemStock);

    click(
      [...dialog!.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Simpan opname",
      )!,
    );
    await wait(500);

    expect(root.textContent).toContain("OPN/2026/11/003");
    expect(root.textContent).toContain("Menunggu review");
  });

  it("returns an item from a completed sale", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/penjualan");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    click(
      [...root.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Detail",
      )!,
    );
    await wait(100);

    click(
      [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Retur",
      )!,
    );
    await wait(100);

    const dialogs = [
      ...document.querySelectorAll<HTMLElement>('[role="dialog"]'),
    ];
    const modal = dialogs.find((dialog) =>
      dialog.textContent?.includes("Retur penjualan"),
    );
    expect(modal).toBeDefined();

    const quantity = modal!.querySelector<HTMLInputElement>(
      'input[type="number"]',
    );
    expect(quantity).not.toBeNull();
    quantity!.value = "1";
    quantity!.dispatchEvent(new Event("input", { bubbles: true }));

    const reason = modal!.querySelector<HTMLTextAreaElement>("textarea");
    expect(reason).not.toBeNull();
    reason!.value = "Barang rusak";
    reason!.dispatchEvent(new Event("input", { bubbles: true }));

    click(
      [...modal!.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Simpan retur",
      )!,
    );
    await wait(500);

    expect(root.textContent).toContain("Retur sebagian");
  });

  it("guards unsaved settings changes", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/pengaturan?tab=profil");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    const nameLabel = [...root.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("Nama toko"),
    );
    const nameInput = document.getElementById(
      nameLabel!.getAttribute("for")!,
    ) as HTMLInputElement;
    nameInput.value = "Toko Baru";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));

    const strukTab = () =>
      [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
        (tab) => tab.textContent?.includes("Struk"),
      );
    click(strukTab()!);
    await wait(100);

    const discard = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(discard?.textContent).toContain("Buang perubahan?");
    click(
      [...discard!.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Batal",
      )!,
    );
    await wait(100);

    expect(window.location.search).toContain("tab=profil");
    expect(nameInput.value).toBe("Toko Baru");

    click(strukTab()!);
    await wait(100);
    const confirm = document.querySelector<HTMLElement>('[role="dialog"]');
    click(
      [...confirm!.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Tinggalkan",
      )!,
    );
    await wait(300);

    expect(window.location.search).toContain("tab=struk");
    expect(root.textContent).toContain("Ukuran kertas");

    const profilTab = [
      ...root.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ].find((tab) => tab.textContent?.includes("Profil Toko"));
    click(profilTab!);
    await wait(300);

    const revertedLabel = [...root.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("Nama toko"),
    );
    const revertedInput = document.getElementById(
      revertedLabel!.getAttribute("for")!,
    ) as HTMLInputElement;
    expect(revertedInput.value).toBe("TOKO JOJO");
  });

  it("uses a sticky save bar for server settings", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/pengaturan?tab=profil");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    const save = () =>
      [...root.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === "Simpan perubahan",
      );
    expect(save()).toBeDefined();
    expect(save()!.disabled).toBe(true);

    const nameLabel = [...root.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("Nama toko"),
    );
    const nameInput = document.getElementById(
      nameLabel!.getAttribute("for")!,
    ) as HTMLInputElement;
    nameInput.value = "Toko Sticky";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(30);

    expect(save()!.disabled).toBe(false);
    click(save()!);
    await wait(500);

    expect(save()!.disabled).toBe(true);
    expect(root.textContent).toContain("Semua perubahan tersimpan");
  });

  it("guards unsaved settings changes on route navigation", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/pengaturan?tab=profil");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    const nameLabel = [...root.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("Nama toko"),
    );
    const nameInput = document.getElementById(
      nameLabel!.getAttribute("for")!,
    ) as HTMLInputElement;
    nameInput.value = "Toko Sebelum Pindah";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));

    const productLink = [...root.querySelectorAll("nav a")].find((link) =>
      link.textContent?.includes("Produk"),
    );
    click(productLink!);
    await wait(100);

    const discard = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(discard?.textContent).toContain("Buang perubahan?");
    click(
      [...discard!.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Tinggalkan",
      )!,
    );
    await wait(300);

    expect(window.location.pathname).toBe("/produk");
  });

  it("confirms before deciding an opname", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/gudang");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    click(
      [...root.querySelectorAll('[role="tab"]')].find((tab) =>
        tab.textContent?.includes("Opname"),
      )!,
    );
    await wait(100);

    click(
      [...root.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Setujui",
      )!,
    );
    await wait(100);

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain("Setujui opname ini?");
    expect(dialog?.textContent).toContain("Selisih akan diterapkan");

    click(
      [...dialog!.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Batal",
      )!,
    );
    await wait(100);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("resets the selected report when the category changes", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/laporan");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    const categoryButton = (label: string) =>
      [...root.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === label,
      );
    const hasRange = () =>
      [...root.querySelectorAll("button")].some(
        (button) => button.textContent?.trim() === "7 Hari",
      );

    expect(hasRange()).toBe(true);

    click(categoryButton("Persediaan")!);
    await wait(100);

    expect(root.textContent).not.toContain(
      "Penjualan Harian / Mingguan / Bulanan",
    );
    expect(hasRange()).toBe(false);

    click(categoryButton("Keuangan")!);
    await wait(100);

    expect(root.textContent).not.toContain("Ikhtisar & Valuasi Stok");
    expect(root.textContent).toContain("Hutang Supplier");
    expect(hasRange()).toBe(false);

    click(categoryButton("Penjualan")!);
    await wait(100);

    expect(hasRange()).toBe(true);
  });

  it("limits a cashier to permitted modules in read-only mode", async () => {
    const root = mount();
    await login(root, "kasir");

    const nav = root.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav!.textContent).toContain("Penjualan");
    expect(nav!.textContent).toContain("Produk");
    expect(nav!.textContent).not.toContain("Pembelian");
    expect(nav!.textContent).not.toContain("Keuangan");
    expect(nav!.textContent).not.toContain("Laporan");
    expect(nav!.textContent).not.toContain("Karyawan");

    const productLink = [...root.querySelectorAll("a")].find((link) =>
      link.textContent?.includes("Produk"),
    );
    click(productLink!);
    await wait(500);

    expect(root.textContent).not.toContain("Tambah Produk");

    window.history.pushState(null, "", "/pembelian");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(300);

    expect(root.textContent).toContain("Akses ditolak");
    expect(root.querySelectorAll("a button")).toHaveLength(0);

    window.history.pushState(null, "", "/pengaturan?tab=profil");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(300);

    expect(root.textContent).toContain("Akses ditolak");

    window.history.pushState(null, "", "/pengaturan");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(300);

    expect(root.textContent).toContain("Tampilan");
    expect(root.textContent).toContain("Kembalikan default");
  });

  it("opens the off-canvas sidebar from the mobile menu toggle", async () => {
    const root = mount();
    await login(root, "owner");

    const sidebar = root.querySelector("aside");
    expect(sidebar).not.toBeNull();
    expect(sidebar!.className).toContain("-translate-x-full");

    const toggle = root.querySelector('button[aria-label="Buka menu"]');
    expect(toggle).not.toBeNull();
    click(toggle!);
    await wait(30);

    expect(sidebar!.className).toContain("translate-x-0");
    expect(sidebar!.className).not.toContain("-translate-x-full");
  });

  it("hides sales panels from the warehouse dashboard", async () => {
    const root = mount();
    await login(root, "gudang");
    await wait(300);

    expect(root.textContent).toContain("Total SKU");
    expect(root.textContent).toContain("Hutang supplier");
    expect(root.textContent).not.toContain("Tren penjualan");
    expect(root.textContent).not.toContain("Penjualan terbaru");

    const salesLink = [...root.querySelectorAll("a")].find(
      (link) => link.getAttribute("href") === "/penjualan",
    );
    expect(salesLink).toBeUndefined();
    expect(root.querySelectorAll("a button")).toHaveLength(0);
  });

  it("does not show opname approval actions to warehouse", async () => {
    const root = mount();
    await login(root, "gudang");

    window.history.pushState(null, "", "/gudang");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(400);

    const opnameTab = [...root.querySelectorAll('[role="tab"]')].find((tab) =>
      tab.textContent?.includes("Opname"),
    );
    expect(opnameTab).toBeDefined();
    click(opnameTab!);
    await wait(200);

    const reviewButtons = [...root.querySelectorAll("button")].filter(
      (button) =>
        button.textContent?.trim() === "Setujui" ||
        button.textContent?.trim() === "Tolak",
    );
    expect(reviewButtons).toHaveLength(0);
  });

  it("prevents an admin from selecting OWNER for a user", async () => {
    const root = mount();
    await login(root, "admin");

    window.history.pushState(null, "", "/pengguna");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(400);

    click(
      [...root.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Tambah Pengguna"),
      )!,
    );
    await wait(100);

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const roleSelect = dialog!.querySelector<HTMLSelectElement>("select");
    expect(roleSelect).not.toBeNull();
    const values = [...roleSelect!.options].map((option) => option.value);
    expect(values).not.toContain("OWNER");
  });

  it("supports arrow-key navigation between tabs", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/gudang");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(400);

    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const mutasi = tabs.find((tab) => tab.textContent?.includes("Mutasi"));
    const opname = tabs.find((tab) => tab.textContent?.includes("Opname"));
    expect(mutasi).toBeDefined();
    expect(opname).toBeDefined();

    mutasi!.focus();
    mutasi!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await wait(50);

    expect(opname!.getAttribute("aria-selected")).toBe("true");
    expect(opname!.getAttribute("aria-controls")).toBe("warehouse-panel");
    expect(document.activeElement).toBe(opname);
    expect(
      root.querySelector('[role="tabpanel"]#warehouse-panel'),
    ).not.toBeNull();
  });

  it("associates field labels and search inputs with controls", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/produk");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(400);

    const search = root.querySelector<HTMLInputElement>('input[type="search"]');
    expect(search).not.toBeNull();
    expect(search!.getAttribute("aria-label")).toBeTruthy();

    click(
      [...root.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Tambah Produk"),
      )!,
    );
    await wait(100);

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const label = [...dialog!.querySelectorAll("label")].find((item) =>
      item.textContent?.includes("Nama produk"),
    );
    expect(label).toBeDefined();
    expect(label!.getAttribute("for")).toBeTruthy();
    expect(document.getElementById(label!.getAttribute("for")!)).not.toBeNull();
  });

  it("gives filter and settings controls accessible names", async () => {
    const root = mount();
    await login(root, "owner");

    window.history.pushState(null, "", "/produk");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(400);

    for (const label of ["Kategori", "Status", "Lokasi"]) {
      expect(
        root.querySelector(`select[aria-label="${label}"]`),
      ).not.toBeNull();
    }

    window.history.pushState(null, "", "/pengaturan?tab=struk");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    expect(
      root.querySelector('select[aria-label="Ukuran kertas"]'),
    ).not.toBeNull();

    window.history.pushState(null, "", "/pengaturan?tab=stok");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(500);

    expect(
      root.querySelector('select[aria-label="Lokasi default"]'),
    ).not.toBeNull();
    expect(
      root.querySelector('input[aria-label="Ambang stok menipis"]'),
    ).not.toBeNull();
  });

  it("opens every owner route with mock data", async () => {
    const root = mount();
    await login(root, "owner");

    const routes = [
      ["/produk", "Master Produk"],
      ["/pelanggan", "Pelanggan"],
      ["/persediaan", "Persediaan"],
      ["/pembelian", "Pembelian"],
      ["/penjualan", "Penjualan"],
      ["/gudang", "Gudang"],
      ["/keuangan", "Keuangan"],
      ["/laporan", "Laporan"],
      ["/pengguna", "Pengguna & Audit"],
      ["/pengaturan", "Pengaturan"],
    ] as const;

    for (const [path, heading] of routes) {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
      await wait(350);
      expect(root.textContent).toContain(heading);
    }
  });
});

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

    expect(root.textContent).toContain("Master Produk (12 SKU)");
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

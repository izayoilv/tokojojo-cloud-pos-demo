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

    expect(root.textContent).toContain("Ringkasan Eksekutif TOKO JOJO");
    expect(root.textContent).toContain("Tren Penjualan vs HPP");
    expect(root.textContent).toContain("Transaksi POS Terbaru");

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

    expect(root.textContent).toContain("Pusat Laporan");
    expect(root.textContent).toContain("Ikhtisar & Valuasi Stok");
  });

  it("limits a cashier to permitted modules in read-only mode", async () => {
    const root = mount();
    await login(root, "kasir");

    const nav = root.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav!.textContent).toContain("Penjualan (POS)");
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

    expect(root.textContent).toContain("Mode lihat");
    expect(root.textContent).not.toContain("Tambah Produk");

    window.history.pushState(null, "", "/soon/purchasing");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(300);

    expect(root.textContent).toContain("Akses ditolak");
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
});

import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Store,
  X,
} from "lucide-solid";
import type { JSX } from "solid-js";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";

import { repository } from "../data/repository";
import { stockStatus } from "../lib/calc";
import { useAuth } from "./auth";
import {
  canAccess,
  initials,
  moduleByPath,
  roleMeta,
  visibleSections,
} from "./rbac";
import { useToast } from "./toast";

type NotificationItem = {
  tone: string;
  title: string;
  detail: string;
};

export function AppLayout(props: { children?: JSX.Element }) {
  const auth = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = createSignal(false);
  const [collapsed, setCollapsed] = createSignal(false);
  const [search, setSearch] = createSignal("");

  const user = () => auth.user();
  const roleInfo = () => (user() ? roleMeta[user()!.role] : roleMeta.ADMIN);
  const sections = () => (user() ? visibleSections(user()!.role) : []);
  const activeModule = createMemo(() => moduleByPath(location.pathname));

  const productsQuery = createQuery(() => ({
    queryKey: ["products"],
    queryFn: () => repository.listProducts(),
  }));
  const transfersQuery = createQuery(() => ({
    queryKey: ["transfers"],
    queryFn: () => repository.listTransfers(),
  }));
  const payablesQuery = createQuery(() => ({
    queryKey: ["payables"],
    queryFn: () => repository.listPayables(),
  }));

  const notifications = createMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    const role = user()?.role;

    for (const product of productsQuery.data ?? []) {
      const status = stockStatus(product);
      if (status === "HABIS") {
        items.push({
          tone: "#DC2626",
          title: `Stok habis: ${product.name}`,
          detail: "Segera buat PO ke supplier.",
        });
      } else if (status === "MENIPIS") {
        items.push({
          tone: "#F59E0B",
          title: `Stok menipis: ${product.name}`,
          detail: `${product.storeStock} di toko / ${product.warehouseStock} di gudang.`,
        });
      }
    }

    for (const transfer of role && canAccess(role, "WAREHOUSE")
      ? (transfersQuery.data ?? []).filter((item) => item.status === "PENDING")
      : []) {
      items.push({
        tone: "#2563EB",
        title: `Mutasi pending: ${transfer.number}`,
        detail: `${transfer.itemCount} jenis barang — ${transfer.createdBy}.`,
      });
    }

    for (const payable of role && canAccess(role, "PURCHASING")
      ? (payablesQuery.data ?? [])
      : []) {
      const remaining = payable.total - payable.paid;
      if (remaining > 0) {
        items.push({
          tone: "#DC2626",
          title: `Hutang jatuh tempo: ${payable.supplierName}`,
          detail: `${payable.invoice} — sisa Rp ${remaining.toLocaleString("id-ID")}.`,
        });
      }
    }

    return items;
  });

  // Close the off-canvas sidebar whenever the route changes.
  createEffect(
    on(
      () => location.pathname,
      () => setMobileOpen(false),
    ),
  );

  const submitSearch = (event: SubmitEvent) => {
    event.preventDefault();
    const query = search().trim();
    navigate(query ? `/products?q=${encodeURIComponent(query)}` : "/products");
  };

  const logout = () => {
    auth.logout();
    navigate("/login", { replace: true });
    toast.notify("Sesi berakhir. Sampai jumpa.", "warn");
  };

  return (
    <div class="flex h-dvh overflow-hidden bg-canvas">
      <Show when={mobileOpen()}>
        <button
          type="button"
          aria-label="Tutup menu"
          class="fixed inset-0 z-40 cursor-default bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      </Show>

      <aside
        class={`fixed inset-y-0 left-0 z-50 flex flex-col bg-navy text-white transition-[width,transform] duration-200 lg:static lg:translate-x-0 ${
          mobileOpen() ? "translate-x-0" : "-translate-x-full"
        } ${collapsed() ? "w-16" : "w-[232px]"}`}
      >
        <div class="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-3.5">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-white text-[13px] font-extrabold text-navy">
            TJ
          </span>
          <Show when={!collapsed()}>
            <div class="min-w-0">
              <div class="truncate text-sm font-extrabold tracking-[.05em]">
                TOKO JOJO
              </div>
              <div class="text-[9.5px] text-[#8FA5C8]">ADMIN ERP</div>
            </div>
          </Show>
          <button
            type="button"
            aria-label="Tutup menu"
            class="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#C4D2EA] hover:bg-white/10 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav class="flex-1 overflow-y-auto px-2 py-2.5">
          <For each={sections()}>
            {(section) => (
              <div>
                <Show when={!collapsed()}>
                  <div class="px-2.5 pt-3 pb-1 text-[9.5px] font-extrabold tracking-[.12em] whitespace-nowrap text-[#5E77A3]">
                    {section.title}
                  </div>
                </Show>
                <For each={section.items}>
                  {(item) => {
                    const active = () => activeModule()?.key === item.key;
                    return (
                      <A
                        href={item.path}
                        title={item.label}
                        class={`mb-0.5 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
                          active()
                            ? "bg-royal font-bold text-white shadow-[0_2px_8px_rgba(29,78,216,.4)]"
                            : "text-[#C4D2EA] hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span
                          class="flex size-[30px] shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold tracking-[.03em]"
                          style={{
                            background: `${item.color}22`,
                            color: item.color,
                          }}
                        >
                          {item.short}
                        </span>
                        <Show when={!collapsed()}>
                          <span class="truncate">{item.label}</span>
                          <Show when={!item.built}>
                            <span class="ml-auto rounded-full bg-white/10 px-1.5 py-px text-[8.5px] font-extrabold tracking-wide text-[#8FA5C8]">
                              SEGERA
                            </span>
                          </Show>
                        </Show>
                      </A>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </nav>

        <div class="shrink-0 border-t border-white/10 p-2">
          <div class="flex items-center gap-2.5 rounded-[9px] bg-white/5 px-2.5 py-2">
            <span class="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-blue text-[11px] font-bold">
              {initials(user()?.name ?? "TJ")}
            </span>
            <Show when={!collapsed()}>
              <div class="min-w-0">
                <div class="truncate text-xs font-bold">{user()?.name}</div>
                <div class="truncate text-[10px] text-[#8FA5C8]">
                  {roleInfo().label}
                </div>
              </div>
            </Show>
          </div>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="flex h-14 shrink-0 items-center gap-2.5 border-b border-line bg-white px-3 md:gap-3.5 md:px-[18px]">
          <button
            type="button"
            aria-label="Buka menu"
            class="flex size-[34px] cursor-pointer items-center justify-center rounded-lg border border-line bg-white text-muted hover:bg-canvas lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={17} />
          </button>
          <button
            type="button"
            aria-label={collapsed() ? "Perluas sidebar" : "Ciutkan sidebar"}
            class="hidden size-[34px] cursor-pointer items-center justify-center rounded-lg border border-line bg-white text-muted hover:bg-canvas lg:flex"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed() ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </button>

          <div class="hidden min-w-0 text-[13px] whitespace-nowrap text-muted sm:block">
            <span class="hidden md:inline">Toko Jojo / </span>
            <b class="font-bold text-ink">
              {activeModule()?.label ?? "Dashboard"}
            </b>
          </div>

          <form
            class="hidden h-[38px] max-w-[380px] flex-1 items-center gap-2 rounded-[9px] border-[1.5px] border-line bg-canvas px-3 md:flex"
            onSubmit={submitSearch}
          >
            <Search size={14} class="shrink-0 text-faint" />
            <input
              class="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-faint"
              placeholder="Cari produk, SKU, barcode, no. struk..."
              value={search()}
              onInput={(event) => setSearch(event.currentTarget.value)}
            />
          </form>

          <div class="ml-auto flex items-center gap-2 md:gap-2.5">
            <DropdownMenu>
              <DropdownMenu.Trigger
                aria-label="Notifikasi"
                class="relative flex size-[34px] cursor-pointer items-center justify-center rounded-lg border border-line bg-white text-muted outline-none hover:bg-canvas"
              >
                <Bell size={16} />
                <Show when={notifications().length > 0}>
                  <span class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-extrabold text-white">
                    {notifications().length}
                  </span>
                </Show>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class="z-[300] w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white shadow-[0_12px_32px_rgba(15,23,42,.16)] outline-none">
                  <div class="border-b border-line px-4 py-3 text-xs font-extrabold text-ink">
                    Notifikasi ({notifications().length})
                  </div>
                  <Show
                    when={notifications().length > 0}
                    fallback={
                      <div class="px-4 py-8 text-center text-xs text-faint">
                        Tidak ada notifikasi
                      </div>
                    }
                  >
                    <div class="max-h-[320px] overflow-y-auto">
                      <For each={notifications()}>
                        {(item) => (
                          <DropdownMenu.Item class="flex cursor-default gap-2.5 border-b border-slate-100 px-4 py-2.5 text-xs outline-none hover:bg-canvas">
                            <span
                              class="mt-1.5 size-[7px] shrink-0 rounded-full"
                              style={{ background: item.tone }}
                            />
                            <span class="min-w-0">
                              <span class="block font-bold text-ink">
                                {item.title}
                              </span>
                              <span class="mt-0.5 block text-muted">
                                {item.detail}
                              </span>
                            </span>
                          </DropdownMenu.Item>
                        )}
                      </For>
                    </div>
                  </Show>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenu.Trigger class="flex h-[34px] cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-2 text-xs font-bold text-muted outline-none hover:bg-canvas md:px-3">
                <span class="flex size-[22px] items-center justify-center rounded-full bg-blue text-[10px] text-white">
                  {initials(user()?.name ?? "TJ")}
                </span>
                <span class="hidden max-w-28 truncate md:inline">
                  {user()?.name.split(" ")[0]}
                </span>
                <ChevronDown size={13} class="hidden md:block" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class="z-[300] w-[250px] overflow-hidden rounded-xl border border-line bg-white shadow-[0_12px_32px_rgba(15,23,42,.16)] outline-none">
                  <div class="border-b border-line px-4 py-3">
                    <div class="truncate text-xs font-extrabold text-ink">
                      {user()?.name}
                    </div>
                    <div class="mt-0.5 truncate text-[10.5px] text-muted">
                      {roleInfo().label} &middot; {user()?.email}
                    </div>
                  </div>
                  <DropdownMenu.Item
                    onSelect={logout}
                    class="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-xs font-bold text-danger outline-none hover:bg-red-50"
                  >
                    <LogOut size={14} /> Keluar Sesi
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
          </div>
        </header>

        <main class="flex-1 overflow-y-auto p-4 md:p-[22px]">
          {props.children}
        </main>

        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-4 py-2 text-[10.5px] text-faint">
          <span class="flex items-center gap-1.5">
            <Store size={12} /> Toko Jojo &middot; Batam Centre
          </span>
          <span>Data contoh &mdash; belum terhubung ke API</span>
        </footer>
      </div>
    </div>
  );
}

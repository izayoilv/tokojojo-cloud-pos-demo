import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import { usePreferences } from "@tokojojo/ui";
import { useToast } from "@tokojojo/ui";
import {
  Bell,
  Check,
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-solid";
import type { JSX } from "solid-js";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
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

type NotificationTone = "danger" | "warning" | "info";

type NotificationItem = {
  tone: NotificationTone;
  title: string;
  detail: string;
};

const toneDot: Record<NotificationTone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
};

export function AppLayout(props: { children?: JSX.Element }) {
  const auth = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const preferences = usePreferences();

  const [mobileOpen, setMobileOpen] = createSignal(false);
  const [collapsed, setCollapsed] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [desktopNav, setDesktopNav] = createSignal(
    typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches,
  );

  onMount(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktopNav(query.matches);
    update();
    query.addEventListener("change", update);
    onCleanup(() => query.removeEventListener("change", update));
  });

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
  const opnamesQuery = createQuery(() => ({
    queryKey: ["opnames"],
    queryFn: () => repository.listOpnames(),
  }));

  const notifications = createMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    const role = user()?.role;

    for (const product of productsQuery.data ?? []) {
      const status = stockStatus(product);
      if (status === "HABIS") {
        items.push({
          tone: "danger",
          title: `Stok habis: ${product.name}`,
          detail: "Segera buat pembelian ke supplier.",
        });
      } else if (status === "MENIPIS") {
        items.push({
          tone: "warning",
          title: `Stok menipis: ${product.name}`,
          detail: `${product.storeStock} di toko · ${product.warehouseStock} di gudang.`,
        });
      }
    }

    for (const transfer of role && canAccess(role, "GUDANG")
      ? (transfersQuery.data ?? []).filter((item) => item.status === "PENDING")
      : []) {
      items.push({
        tone: "info",
        title: `Mutasi pending: ${transfer.number}`,
        detail: `${transfer.itemCount} jenis barang · ${transfer.createdBy}.`,
      });
    }

    for (const opname of role && canAccess(role, "GUDANG")
      ? (opnamesQuery.data ?? []).filter(
          (item) => item.status === "PENDING_REVIEW",
        )
      : []) {
      items.push({
        tone: "warning",
        title: `Opname menunggu review: ${opname.number}`,
        detail: `${opname.items.length} produk · ${opname.createdBy}.`,
      });
    }

    for (const payable of role && canAccess(role, "PEMBELIAN")
      ? (payablesQuery.data ?? [])
      : []) {
      const remaining = payable.total - payable.paid;
      if (remaining > 0) {
        items.push({
          tone: "danger",
          title: `Hutang jatuh tempo: ${payable.supplierName}`,
          detail: `${payable.invoice} · sisa Rp ${remaining.toLocaleString("id-ID")}.`,
        });
      }
    }

    return items;
  });

  createEffect(
    on(
      () => location.pathname,
      () => setMobileOpen(false),
    ),
  );

  const submitSearch = (event: SubmitEvent) => {
    event.preventDefault();
    const query = search().trim();
    navigate(query ? `/produk?q=${encodeURIComponent(query)}` : "/produk");
  };

  const logout = () => {
    auth.logout();
    navigate("/login", { replace: true });
    toast.notify("Sesi berakhir. Sampai jumpa.", "warning");
  };

  return (
    <div class="flex h-dvh overflow-hidden bg-canvas">
      <Show when={mobileOpen()}>
        <button
          type="button"
          aria-label="Tutup menu"
          class="fixed inset-0 z-40 cursor-default bg-[var(--tj-overlay)] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      </Show>

      <aside
        inert={!desktopNav() && !mobileOpen()}
        aria-hidden={!desktopNav() && !mobileOpen() ? "true" : undefined}
        class={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface transition-[width,transform] duration-200 lg:static lg:translate-x-0 ${
          mobileOpen() ? "translate-x-0" : "-translate-x-full"
        } ${collapsed() ? "w-16" : "w-[240px]"}`}
      >
        <div class="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-3">
          <span class="relative flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-primary text-xs font-extrabold text-on-primary">
            TJ
            <span class="absolute -top-1 -right-1 size-2 rounded-[2px] bg-accent" />
          </span>
          <Show when={!collapsed()}>
            <div class="min-w-0">
              <div class="truncate text-sm font-bold text-ink">
                <span class="font-semibold">Toko</span>
                <span class="font-extrabold">Jojo</span>
              </div>
              <div class="text-[10px] font-bold tracking-[0.08em] text-ink-muted uppercase">
                Admin ERP
              </div>
            </div>
          </Show>
          <button
            type="button"
            aria-label="Tutup menu"
            class="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-[6px] text-ink-muted hover:bg-subtle hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav class="flex-1 overflow-y-auto px-2 py-2">
          <For each={sections()}>
            {(section) => (
              <div>
                <Show when={!collapsed()}>
                  <div class="px-2 pt-3 pb-1 text-[10px] font-extrabold tracking-[0.12em] text-ink-muted uppercase">
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
                        aria-current={active() ? "page" : undefined}
                        class={`mb-0.5 flex min-h-9 items-center gap-2.5 rounded-[6px] px-2 text-sm transition-colors ${
                          active()
                            ? "bg-primary-soft font-bold text-primary"
                            : "font-semibold text-ink-secondary hover:bg-subtle hover:text-ink"
                        }`}
                      >
                        <span
                          class={`flex size-7 shrink-0 items-center justify-center rounded-[4px] ${
                            active()
                              ? "bg-primary text-on-primary"
                              : "bg-subtle text-ink-muted"
                          }`}
                        >
                          <item.icon size={16} />
                        </span>
                        <Show when={!collapsed()}>
                          <span class="truncate">{item.label}</span>
                        </Show>
                      </A>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </nav>

        <div class="shrink-0 border-t border-line p-2">
          <div class="flex items-center gap-2 rounded-[6px] px-2 py-1.5">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{
                background: `${roleInfo().color}18`,
                color: roleInfo().color,
              }}
            >
              {initials(user()?.name ?? "TJ")}
            </span>
            <Show when={!collapsed()}>
              <div class="min-w-0">
                <div class="truncate text-xs font-bold text-ink">
                  {user()?.name}
                </div>
                <div class="truncate text-[10px] font-semibold text-ink-muted">
                  {roleInfo().label}
                </div>
              </div>
            </Show>
          </div>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="flex min-h-14 shrink-0 flex-wrap items-center gap-2.5 border-b border-line bg-surface px-3 md:gap-3 md:px-4">
          <button
            type="button"
            aria-label="Buka menu"
            class="flex size-9 cursor-pointer items-center justify-center rounded-[6px] text-ink-muted hover:bg-subtle hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>
          <button
            type="button"
            aria-label={collapsed() ? "Perluas sidebar" : "Ciutkan sidebar"}
            class="hidden size-9 cursor-pointer items-center justify-center rounded-[6px] text-ink-muted hover:bg-subtle hover:text-ink lg:flex"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed() ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>

          <div class="hidden min-w-0 text-xs whitespace-nowrap text-ink-muted sm:block">
            TokoJojo /{" "}
            <b class="font-bold text-ink">
              {activeModule()?.label ?? "Ringkasan"}
            </b>
          </div>

          <form
            class="order-last flex h-10 w-full items-center gap-2 rounded-[6px] border border-line-control bg-surface px-3 md:order-none md:max-w-[360px] md:flex-1"
            onSubmit={submitSearch}
          >
            <Search size={15} class="shrink-0 text-ink-muted" />
            <input
              class="min-w-0 flex-1 border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              aria-label="Cari produk, SKU, barcode, invoice"
              placeholder="Cari produk, SKU, barcode, invoice..."
              value={search()}
              onInput={(event) => setSearch(event.currentTarget.value)}
            />
          </form>

          <div class="ml-auto flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenu.Trigger
                aria-label="Notifikasi"
                class="relative flex size-9 cursor-pointer items-center justify-center rounded-[6px] text-ink-muted outline-none hover:bg-subtle hover:text-ink"
              >
                <Bell size={17} />
                <Show when={notifications().length > 0}>
                  <span class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-on-danger">
                    {notifications().length}
                  </span>
                </Show>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class="z-[300] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-[8px] border border-line bg-surface shadow-dropdown outline-none">
                  <div class="border-b border-line px-4 py-3 text-sm font-bold text-ink">
                    Notifikasi ({notifications().length})
                  </div>
                  <Show
                    when={notifications().length > 0}
                    fallback={
                      <div class="px-4 py-8 text-center text-sm text-ink-muted">
                        Tidak ada notifikasi
                      </div>
                    }
                  >
                    <div class="max-h-[340px] overflow-y-auto">
                      <For each={notifications()}>
                        {(item) => (
                          <DropdownMenu.Item class="flex cursor-default gap-2.5 border-b border-line px-4 py-2.5 text-sm outline-none last:border-0 hover:bg-hover">
                            <span
                              class={`mt-1.5 size-2 shrink-0 rounded-full ${toneDot[item.tone]}`}
                            />
                            <span class="min-w-0">
                              <span class="block font-semibold text-ink">
                                {item.title}
                              </span>
                              <span class="mt-0.5 block text-xs text-ink-muted">
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
              <DropdownMenu.Trigger class="flex h-9 cursor-pointer items-center gap-2 rounded-[6px] px-1.5 text-xs font-semibold text-ink-secondary outline-none hover:bg-subtle md:px-2">
                <span
                  class="flex size-7 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: `${roleInfo().color}18`,
                    color: roleInfo().color,
                  }}
                >
                  {initials(user()?.name ?? "TJ")}
                </span>
                <span class="hidden max-w-28 truncate md:inline">
                  {user()?.name.split(" ")[0]}
                </span>
                <ChevronDown size={14} class="hidden md:block" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class="z-[300] w-[280px] overflow-hidden rounded-[8px] border border-line bg-surface shadow-dropdown outline-none">
                  <div class="border-b border-line px-4 py-3">
                    <div class="truncate text-sm font-bold text-ink">
                      {user()?.name}
                    </div>
                    <div class="mt-0.5 truncate text-xs text-ink-muted">
                      {roleInfo().label} · {user()?.email}
                    </div>
                  </div>
                  <div class="space-y-3 border-b border-line px-4 py-3">
                    <div>
                      <div class="mb-1 text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                        Tema
                      </div>
                      <div class="flex gap-1">
                        <For
                          each={
                            [
                              ["light", "Terang"],
                              ["dark", "Gelap"],
                              ["system", "Sistem"],
                            ] as const
                          }
                        >
                          {([value, label]) => (
                            <button
                              type="button"
                              onClick={() => preferences.setTheme(value)}
                              class={`h-7 flex-1 cursor-pointer rounded-[4px] text-xs font-semibold ${
                                preferences.theme() === value
                                  ? "bg-primary-soft text-primary"
                                  : "text-ink-muted hover:bg-subtle"
                              }`}
                            >
                              {label}
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                    <div>
                      <div class="mb-1 text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                        Ukuran teks
                      </div>
                      <div class="flex gap-1">
                        <For
                          each={
                            [
                              ["normal", "Normal"],
                              ["large", "Besar"],
                            ] as const
                          }
                        >
                          {([value, label]) => (
                            <button
                              type="button"
                              onClick={() => preferences.setTextSize(value)}
                              class={`h-7 flex-1 cursor-pointer rounded-[4px] text-xs font-semibold ${
                                preferences.textSize() === value
                                  ? "bg-primary-soft text-primary"
                                  : "text-ink-muted hover:bg-subtle"
                              }`}
                            >
                              {label}
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                  <A
                    href="/pengaturan"
                    class="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold text-ink-secondary hover:bg-hover"
                  >
                    <Check size={14} /> Pengaturan tampilan
                  </A>
                  <DropdownMenu.Item
                    onSelect={logout}
                    class="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-bold text-danger outline-none hover:bg-danger-soft"
                  >
                    <LogOut size={15} /> Keluar
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
          </div>
        </header>

        <main class="flex-1 overflow-y-auto p-4 md:p-6">{props.children}</main>
      </div>
    </div>
  );
}

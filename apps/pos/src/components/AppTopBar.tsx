import { Lock, LogOut, Settings, Store } from "lucide-solid";
import { createSignal, onCleanup, onMount, Show } from "solid-js";

import { usePos } from "../app/PosProvider";
import { formatClock, formatDate, formatTime } from "../lib/format";
import { StateChip, StateChipMenu } from "./StateChip";

export function AppTopBar() {
  const pos = usePos();
  const [now, setNow] = createSignal(new Date());

  onMount(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    onCleanup(() => window.clearInterval(timer));
  });

  const shiftLabel = () => {
    const shift = pos.state.shift();
    if (!shift) return "Belum buka shift";
    if (shift.status === "CLOSED") return "Shift ditutup";
    return `Shift ${shift.id.replace("SHIFT-", "")} · ${formatTime(shift.openedAt)}`;
  };

  const roleLabel = () => {
    const role = pos.state.session()?.role;
    if (role === "OWNER") return "Owner";
    if (role === "ADMIN") return "Admin";
    return "Kasir";
  };

  return (
    <header class="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <div class="flex min-w-0 items-center gap-2.5">
        <span class="relative flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-primary text-xs font-extrabold text-on-primary">
          TJ
          <span class="absolute -top-1 -right-1 size-2 rounded-[2px] bg-accent" />
        </span>
        <div class="min-w-0">
          <div class="truncate text-sm leading-tight font-bold text-ink">
            Toko <span class="font-extrabold">Jojo</span>
          </div>
          <div class="truncate text-sm font-bold tracking-[0.08em] text-ink-muted uppercase">
            POS · Batam Centre
          </div>
        </div>
      </div>

      <span class="h-7 w-px shrink-0 bg-line" />

      <Show
        when={pos.state.session()}
        fallback={
          <div class="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink-muted">
            <Store size={14} />
            <span class="truncate">Perangkat belum masuk</span>
          </div>
        }
      >
        {(session) => (
          <div class="flex min-w-0 items-center gap-4">
            <div class="min-w-0">
              <div class="text-sm font-bold tracking-[0.08em] text-ink-muted uppercase">
                {roleLabel()}
              </div>
              <div class="truncate text-xs font-bold text-ink">
                {session().name}
              </div>
            </div>
            <div class="hidden min-w-0 lg:block">
              <div class="text-sm font-bold tracking-[0.08em] text-ink-muted uppercase">
                Shift
              </div>
              <div class="truncate text-xs font-semibold text-ink-secondary">
                {shiftLabel()}
              </div>
            </div>
            <Show
              when={
                pos.state.shift()?.status === "OPEN" &&
                pos.state.connection() !== "LOCKED"
              }
            >
              <button
                type="button"
                data-action="open-close-shift"
                aria-label="Tutup shift"
                title="Tutup shift"
                onClick={() => pos.actions.go("CLOSE_SHIFT")}
                class="flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-[5px] border border-line-control bg-surface px-2 text-sm font-bold text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <LogOut size={13} />
                <span class="hidden xl:inline">Tutup shift</span>
              </button>
            </Show>
          </div>
        )}
      </Show>

      <div class="ml-auto flex shrink-0 items-center gap-3">
        <Show
          when={import.meta.env.DEV && pos.state.connection() !== "LOCKED"}
          fallback={<StateChip connection={pos.state.connection()} />}
        >
          <StateChipMenu />
        </Show>

        <div class="text-right leading-tight">
          <div class="font-mono text-sm font-bold text-ink tabular-nums">
            {formatClock(now())}
          </div>
          <div class="hidden text-sm font-semibold text-ink-muted xl:block">
            {formatDate(now())} · WIB
          </div>
        </div>

        <Show when={pos.state.session()}>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Pengaturan"
              title="Pengaturan"
              onClick={() => pos.actions.go("SETTINGS")}
              class="flex size-11 cursor-pointer items-center justify-center rounded-[6px] border border-line-control bg-surface text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Settings size={17} />
            </button>
            <button
              type="button"
              aria-label="Kunci layar (F12)"
              title="Kunci layar (F12)"
              onClick={() => pos.actions.lock()}
              class="flex size-11 cursor-pointer items-center justify-center rounded-[6px] border border-line-control bg-surface text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Lock size={17} />
            </button>
          </div>
        </Show>
      </div>
    </header>
  );
}

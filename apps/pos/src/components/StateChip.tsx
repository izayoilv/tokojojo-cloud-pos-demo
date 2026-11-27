import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import {
  Check,
  ChevronDown,
  Clock3,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-solid";
import { type Component, For } from "solid-js";
import { Dynamic } from "solid-js/web";

import { usePos } from "../app/PosProvider";
import type { PosConnection } from "../data/types";

type StateMeta = {
  label: string;
  tone: string;
  icon: Component<{ size?: number | string; class?: string }>;
  description: string;
};

const states: Record<PosConnection, StateMeta> = {
  ONLINE: {
    label: "Online",
    tone: "bg-success-soft text-success",
    icon: Wifi,
    description: "Tersambung ke server",
  },
  OFFLINE: {
    label: "Offline",
    tone: "bg-warning-soft text-warning",
    icon: WifiOff,
    description: "Transaksi masuk antrean",
  },
  GRACE: {
    label: "Masa tenggang",
    tone: "bg-warning-soft text-warning",
    icon: Clock3,
    description: "Tunai saja, ditandai",
  },
  LOCKED: {
    label: "Terkunci",
    tone: "bg-danger-soft text-danger",
    icon: ShieldAlert,
    description: "Transaksi baru diblokir",
  },
};

export function StateChip(props: {
  connection: PosConnection;
  class?: string;
}) {
  const meta = () => states[props.connection];

  return (
    <span
      role="status"
      class={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold whitespace-nowrap ${meta().tone} ${props.class ?? ""}`}
    >
      <Dynamic component={meta().icon} size={13} />
      {meta().label}
    </span>
  );
}

export function StateChipMenu() {
  const pos = usePos();

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        aria-label={`Status koneksi: ${states[pos.state.connection()].label}. Ubah status demo`}
        class="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <StateChip connection={pos.state.connection()} />
        <ChevronDown size={12} class="text-ink-muted" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="z-[300] w-[270px] overflow-hidden rounded-[8px] border border-line bg-surface shadow-dropdown outline-none">
          <div class="border-b border-line px-3 py-2">
            <div class="text-xs font-bold text-ink">Simulasi status</div>
            <div class="text-sm font-semibold text-ink-muted">
              Hanya untuk demo UI
            </div>
          </div>
          <For each={Object.keys(states) as PosConnection[]}>
            {(state) => (
              <DropdownMenu.Item
                onSelect={() => pos.actions.setConnection(state)}
                class="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-2 outline-none last:border-0 hover:bg-hover"
              >
                <StateChip connection={state} />
                <span class="truncate text-sm text-ink-muted">
                  {states[state].description}
                </span>
                <span class="ml-auto text-primary">
                  {pos.state.connection() === state ? (
                    <Check size={14} />
                  ) : null}
                </span>
              </DropdownMenu.Item>
            )}
          </For>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  );
}

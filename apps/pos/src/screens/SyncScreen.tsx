import { Button } from "@tokojojo/ui";
import {
  Clock3,
  CloudOff,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-solid";
import { createSignal, For, Show } from "solid-js";

import { usePos } from "../app/PosProvider";
import { StateChip } from "../components/StateChip";
import type { PosConnection } from "../data/types";

const connections: Array<{ value: PosConnection; label: string }> = [
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
  { value: "GRACE", label: "Masa tenggang" },
  { value: "LOCKED", label: "Terkunci" },
];

type ResultTone = "success" | "warning" | "info" | "danger";

const toneText: Record<ResultTone, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  danger: "text-danger",
};

export function SyncScreen() {
  const pos = usePos();
  const [notice, setNotice] = createSignal<string | null>(null);

  const queue = () => pos.state.queue();
  const canSync = () => pos.state.connection() === "ONLINE";

  const syncNow = () => {
    const acceptedBefore = queue().accepted;
    pos.actions.syncNow();
    if (pos.state.error()) {
      setNotice(null);
      return;
    }

    const acceptedAfter = queue().accepted;
    setNotice(
      acceptedAfter > acceptedBefore
        ? `Sinkronisasi selesai. ${acceptedAfter - acceptedBefore} transaksi diterima.`
        : "Tidak ada antrean. Waktu sinkron diperbarui.",
    );
  };

  return (
    <div class="h-full overflow-y-auto bg-canvas p-4">
      <div class="mx-auto flex w-full max-w-[860px] flex-col gap-3">
        <div class="flex flex-wrap items-start gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary">
            <RefreshCw size={21} />
          </span>
          <div class="min-w-0">
            <h1 class="text-lg font-extrabold text-ink">Sinkronisasi</h1>
            <p class="text-xs font-semibold text-ink-muted">
              Antrean offline dan hasil sinkronisasi perangkat.
            </p>
          </div>
          <StateChip
            connection={pos.state.connection()}
            class="ml-auto self-center"
          />
          <Button
            variant="secondary"
            size="lg"
            class="shrink-0"
            onClick={() =>
              pos.actions.go(
                pos.state.connection() === "LOCKED" ? "HARD_LOCK" : "SELL",
              )
            }
          >
            Kembali ke Jual
          </Button>
        </div>

        <Show when={import.meta.env.DEV}>
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="mr-1 text-xs font-extrabold tracking-[0.12em] text-ink-muted uppercase">
              Hanya untuk demo · simulasi status
            </span>
            <For each={connections}>
              {(option) => (
                <button
                  type="button"
                  data-connection={option.value}
                  aria-pressed={pos.state.connection() === option.value}
                  onClick={() => pos.actions.setConnection(option.value)}
                  class={`flex h-11 cursor-pointer items-center gap-1 rounded-[5px] border px-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    pos.state.connection() === option.value
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line-control bg-surface text-ink-secondary hover:bg-hover"
                  }`}
                >
                  <Show
                    when={option.value === "ONLINE"}
                    fallback={
                      option.value === "LOCKED" ? (
                        <ShieldAlert size={11} />
                      ) : option.value === "GRACE" ? (
                        <Clock3 size={11} />
                      ) : (
                        <WifiOff size={11} />
                      )
                    }
                  >
                    <Wifi size={11} />
                  </Show>
                  {option.label}
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class="grid grid-cols-5 gap-2">
          <Stat label="Antrean" value={queue().pending} tone="warning" />
          <Stat label="Diterima" value={queue().accepted} tone="success" />
          <Stat label="Duplikat" value={queue().duplicate} tone="warning" />
          <Stat label="Ditandai" value={queue().flagged} tone="info" />
          <Stat label="Ditolak" value={queue().rejected} tone="danger" />
        </div>

        <div class="rounded-[10px] border border-line bg-surface p-3">
          <div class="flex flex-wrap items-center gap-3">
            <div class="min-w-0 flex-1">
              <div class="text-xs font-extrabold text-ink">
                Antrean transaksi offline
              </div>
              <p class="mt-0.5 text-sm text-ink-muted">
                {queue().pending > 0
                  ? `${queue().pending} transaksi siap dikirim ke server.`
                  : "Tidak ada transaksi menunggu. Sinkronisasi terakhir " +
                    queue().lastSync +
                    "."}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              disabled={!canSync()}
              onClick={syncNow}
            >
              <RefreshCw size={16} /> Sinkron sekarang
            </Button>
          </div>
          <Show when={!canSync()}>
            <div class="mt-2 flex items-start gap-2 rounded-[6px] bg-warning-soft px-3 py-1.5 text-sm text-warning">
              <CloudOff size={14} class="mt-0.5 shrink-0" />
              <p>
                Sinkronisasi membutuhkan koneksi online.{" "}
                {pos.state.connection() === "LOCKED"
                  ? "Perangkat terkunci sampai koneksi pulih."
                  : "Transaksi tetap tersimpan lokal."}
              </p>
            </div>
          </Show>
          <Show when={notice()}>
            <p role="status" class="mt-2 text-sm font-bold text-success">
              {notice()}
            </p>
          </Show>
          <Show when={pos.state.error()}>
            <p role="alert" class="mt-2 text-sm font-bold text-danger">
              {pos.state.error()}
            </p>
          </Show>
        </div>

        <div class="rounded-[10px] border border-line bg-surface">
          <div class="flex items-center gap-2 border-b border-line px-3 py-2">
            <div class="text-xs font-extrabold text-ink">Karantina</div>
            <span class="rounded-full bg-danger-soft px-1.5 py-0.5 text-sm font-bold text-danger">
              {queue().quarantine.length}
            </span>
            <span class="ml-auto text-sm font-semibold text-ink-muted">
              Butuh tinjauan admin
            </span>
          </div>
          <Show
            when={queue().quarantine.length > 0}
            fallback={
              <p class="px-3 py-7 text-center text-xs font-semibold text-ink-muted">
                Tidak ada transaksi karantina.
              </p>
            }
          >
            <For each={queue().quarantine}>
              {(item) => (
                <div class="flex items-start gap-2 border-b border-line px-3 py-2 last:border-0">
                  <ShieldAlert size={15} class="mt-0.5 shrink-0 text-danger" />
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-mono text-sm font-bold text-ink">
                      {item.id}
                    </div>
                    <div class="text-sm font-semibold text-ink-muted">
                      {item.reason}
                    </div>
                  </div>
                  <span class="shrink-0 rounded-full bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger">
                    Karantina
                  </span>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}

function Stat(props: { label: string; value: number; tone: ResultTone }) {
  return (
    <div class="rounded-[8px] border border-line bg-surface px-3 py-2">
      <div class="text-xs font-extrabold tracking-[0.08em] text-ink-muted uppercase">
        {props.label}
      </div>
      <div
        class={`font-mono text-xl font-extrabold tabular-nums ${toneText[props.tone]}`}
      >
        {props.value}
      </div>
    </div>
  );
}

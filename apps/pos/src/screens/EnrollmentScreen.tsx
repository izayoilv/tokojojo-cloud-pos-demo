import { Badge, type BadgeTone, Button } from "@tokojojo/ui";
import {
  ArrowRight,
  CircleX,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-solid";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import { usePos } from "../app/PosProvider";
import type { DeviceStatus } from "../data/types";
import { formatDateTime } from "../lib/format";

const statusMeta: Record<
  DeviceStatus,
  {
    label: string;
    tone: BadgeTone;
    title: string;
    note: string;
    icon: typeof ShieldCheck;
  }
> = {
  PENDING: {
    label: "Menunggu persetujuan",
    tone: "warning",
    title: "Perangkat menunggu persetujuan admin.",
    note: "Penjualan offline baru aktif setelah perangkat disetujui dan token offline diterbitkan.",
    icon: TriangleAlert,
  },
  ACTIVE: {
    label: "Perangkat aktif",
    tone: "success",
    title: "Perangkat aktif dan siap dipakai.",
    note: "PIN lokal hanya membuka sesi perangkat, bukan kredensial server. Kunci privat tetap berada di keychain perangkat.",
    icon: ShieldCheck,
  },
  REVOKED: {
    label: "Perangkat dicabut",
    tone: "danger",
    title: "Perangkat dicabut. Hubungi admin.",
    note: "Perangkat yang dicabut tidak dapat membuka shift atau membuat transaksi baru.",
    icon: CircleX,
  },
};

const demoStates: Array<[DeviceStatus, string]> = [
  ["PENDING", "Menunggu"],
  ["ACTIVE", "Setujui perangkat"],
  ["REVOKED", "Cabut"],
];

export function EnrollmentScreen() {
  const pos = usePos();

  const status = () => pos.state.device().status;
  const meta = () => statusMeta[status()];

  return (
    <div class="flex h-full items-start justify-center overflow-y-auto bg-canvas p-4">
      <div class="my-auto w-full max-w-[560px] overflow-hidden rounded-[12px] border border-line bg-surface shadow-modal">
        <div class="flex items-center gap-3 border-b border-line px-5 py-4">
          <span class="relative flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-primary text-xs font-extrabold text-on-primary">
            TJ
            <span class="absolute -top-1 -right-1 size-2 rounded-[2px] bg-accent" />
          </span>
          <div class="min-w-0">
            <div class="text-sm font-extrabold text-ink">TokoJoJo POS</div>
            <div class="text-sm font-bold tracking-[0.08em] text-ink-muted uppercase">
              Aktivasi perangkat
            </div>
          </div>
          <Badge tone={meta().tone} class="ml-auto">
            {meta().label}
          </Badge>
        </div>

        <div class="px-5 py-4">
          <div class="flex items-start gap-3">
            <span class="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
              <MonitorSmartphone size={22} />
            </span>
            <div class="min-w-0">
              <h1 class="text-lg font-extrabold text-ink">
                Aktifkan perangkat
              </h1>
              <p class="mt-1 text-sm font-semibold text-ink-secondary">
                {meta().title}
              </p>
            </div>
          </div>

          <div class="mt-4 flex items-start gap-2 rounded-[8px] border border-line bg-subtle px-3 py-2.5">
            <Dynamic
              component={meta().icon}
              size={15}
              class="mt-0.5 shrink-0 text-primary"
            />
            <p class="text-xs leading-relaxed text-ink-secondary">
              {meta().note}
            </p>
          </div>

          <dl class="mt-4 grid grid-cols-[132px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt class="text-ink-muted">Nama perangkat</dt>
            <dd class="font-bold text-ink">{pos.state.device().name}</dd>
            <dt class="text-ink-muted">Platform</dt>
            <dd class="font-mono text-xs font-semibold text-ink">
              {pos.state.device().platform}
            </dd>
            <dt class="text-ink-muted">Diminta</dt>
            <dd class="font-semibold text-ink-secondary">
              {formatDateTime(pos.state.device().requestedAt)}
            </dd>
            <dt class="text-ink-muted">Terakhir diperiksa</dt>
            <dd class="font-semibold text-ink-secondary">
              {formatDateTime(pos.state.device().lastCheck)}
            </dd>
            <dt class="text-ink-muted">Disetujui oleh</dt>
            <dd class="font-semibold text-ink-secondary">
              {pos.state.device().enrolledBy ?? "—"}
            </dd>
          </dl>

          <div class="mt-5 flex flex-wrap items-center gap-2">
            <Show when={status() === "PENDING"}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => pos.actions.approveDevice()}
              >
                Aktifkan perangkat
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => pos.actions.setDeviceStatus("PENDING")}
              >
                <RefreshCw size={15} /> Coba lagi
              </Button>
            </Show>

            <Show when={status() === "ACTIVE"}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => pos.actions.go("LOCK")}
              >
                Lanjutkan ke PIN <ArrowRight size={16} />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => pos.actions.setDeviceStatus("REVOKED")}
              >
                Cabut perangkat
              </Button>
            </Show>

            <Show when={status() === "REVOKED"}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => pos.actions.setDeviceStatus("PENDING")}
              >
                <RefreshCw size={15} /> Coba lagi
              </Button>
            </Show>

            <a
              href="mailto:admin@tokojojo.local"
              class="inline-flex h-12 items-center justify-center gap-2 rounded-[6px] px-4 text-sm font-semibold text-ink-secondary transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Hubungi admin
            </a>
          </div>

          <div class="mt-4 rounded-[8px] border border-dashed border-line-strong bg-subtle/60 px-3 py-2.5">
            <div class="mb-2 text-sm font-extrabold tracking-[0.12em] text-ink-muted uppercase">
              Kontrol demo
            </div>
            <div class="flex flex-wrap gap-1.5">
              {demoStates.map(([value, label]) => (
                <button
                  type="button"
                  aria-pressed={status() === value}
                  onClick={() => pos.actions.setDeviceStatus(value)}
                  class={`inline-flex h-11 cursor-pointer items-center rounded-[5px] border px-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    status() === value
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line-control bg-surface text-ink-secondary hover:bg-hover"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p class="mt-2 text-sm font-semibold text-ink-muted">
              Persetujuan admin disimulasikan untuk demo UI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Button } from "@tokojojo/ui";
import { History, LockKeyhole, Wifi } from "lucide-solid";

import { usePos } from "../app/PosProvider";

export function HardLockScreen() {
  const pos = usePos();
  const queue = () => pos.state.queue();

  return (
    <div class="flex h-full items-center justify-center overflow-y-auto bg-canvas p-4">
      <div class="w-full max-w-[480px] rounded-[12px] border border-line bg-surface p-6 text-center shadow-modal">
        <span class="mx-auto flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <LockKeyhole size={28} />
        </span>

        <h1 class="mt-4 text-xl font-extrabold text-ink">POS terkunci</h1>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-secondary">
          Masa tenggang offline sudah berakhir. Penjualan baru diblokir sampai
          perangkat terhubung dan pengguna masuk kembali.
        </p>

        <dl class="mt-5 space-y-1.5 rounded-[8px] border border-line bg-subtle px-3 py-2.5 text-left text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-ink-muted">Sinkronisasi terakhir</dt>
            <dd class="font-semibold text-ink">{queue().lastSync}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-ink-muted">Antrean</dt>
            <dd class="font-mono font-semibold text-ink tabular-nums">
              {queue().pending} transaksi
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-ink-muted">Perangkat</dt>
            <dd class="font-semibold text-ink">{pos.state.device().name}</dd>
          </div>
        </dl>

        <div class="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-left text-sm font-semibold text-danger">
          Transaksi lama tetap tersimpan dan akan dikirim setelah koneksi pulih.
        </div>

        <div class="mt-4 flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            data-action="hard-lock-online"
            onClick={() => pos.actions.setConnection("ONLINE")}
          >
            <Wifi size={16} /> Coba online
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => pos.actions.go("HISTORY")}
          >
            <History size={16} /> Lihat riwayat & cetak ulang
          </Button>
          <a
            href="mailto:admin@tokojojo.local"
            class="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] text-sm font-bold text-ink-secondary transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Hubungi admin
          </a>
        </div>

        <p class="mt-3 text-sm font-semibold text-ink-muted">
          Riwayat dan cetak ulang tetap tersedia. Retur/void menunggu online.
        </p>
      </div>
    </div>
  );
}

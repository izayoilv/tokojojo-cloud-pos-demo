import { Button } from "@tokojojo/ui";
import { CheckCircle2, Plus, Printer } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";

import { usePos } from "../app/PosProvider";
import { ReceiptPreview } from "../components/ReceiptPreview";

export function ReceiptScreen() {
  const pos = usePos();
  const [printNotice, setPrintNotice] = createSignal<string | null>(null);

  onMount(() => {
    if (pos.state.settings().autoPrint) {
      setPrintNotice("Auto-print aktif: struk dikirim ke printer demo.");
    }
  });

  const setPaperSize = (paperSize: "58mm" | "80mm") => {
    pos.actions.saveSettings({ paperSize });
  };

  return (
    <div class="flex h-full min-h-0 flex-col bg-canvas">
      <div class="flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-success">
        <CheckCircle2 size={20} />
        <div>
          <h1 class="text-sm font-extrabold text-ink">Pembayaran berhasil</h1>
          <p class="text-[0.625rem] font-semibold text-ink-muted">
            Struk siap dicetak untuk pelanggan.
          </p>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        <div class="mx-auto flex w-full max-w-[420px] justify-center">
          <Show when={pos.state.receipt()}>
            {(sale) => (
              <ReceiptPreview
                sale={sale()}
                paperSize={pos.state.settings().paperSize}
              />
            )}
          </Show>
        </div>
      </div>

      <div class="shrink-0 border-t border-line bg-surface px-4 py-2">
        <div class="mx-auto flex w-full max-w-[520px] flex-col items-center gap-1.5">
          <div class="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setPrintNotice("Struk dikirim ke printer demo.")}
            >
              <Printer size={16} /> Cetak Struk
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => pos.actions.newTransaction()}
            >
              <Plus size={16} /> Transaksi Baru
            </Button>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-2">
            <div class="flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1">
              <span class="text-[0.625rem] font-bold text-ink-secondary">
                Ukuran kertas
              </span>
              {(["58mm", "80mm"] as const).map((size) => (
                <button
                  type="button"
                  aria-pressed={pos.state.settings().paperSize === size}
                  onClick={() => setPaperSize(size)}
                  class={`h-11 cursor-pointer rounded-full px-2.5 text-[0.625rem] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    pos.state.settings().paperSize === size
                      ? "bg-primary text-on-primary"
                      : "text-ink-muted hover:bg-subtle hover:text-ink"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            <Show when={printNotice()}>
              <p role="status" class="text-[0.625rem] font-bold text-success">
                {printNotice()}
              </p>
            </Show>
          </div>

          <p class="text-center text-[0.625rem] font-semibold text-ink-muted">
            Pratinjau {pos.state.settings().paperSize}. Auto-print{" "}
            {pos.state.settings().autoPrint ? "aktif" : "mati"} dan pengaturan
            printer ada di Pengaturan.
          </p>
        </div>
      </div>
    </div>
  );
}

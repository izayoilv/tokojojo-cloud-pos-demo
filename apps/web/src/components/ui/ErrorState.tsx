import { AlertTriangle, RefreshCw } from "lucide-solid";

import { Button } from "./Button";

export function ErrorState(props: { message?: string; onRetry?: () => void }) {
  return (
    <div class="flex flex-col items-center justify-center gap-3 px-5 py-11 text-center">
      <div class="flex size-11 items-center justify-center rounded-full bg-red-50 text-danger">
        <AlertTriangle size={22} />
      </div>
      <div>
        <p class="text-[13px] font-bold text-ink">Gagal memuat data</p>
        <p class="mt-1 max-w-md text-xs text-muted">
          {props.message ?? "Terjadi kesalahan saat mengambil data."}
        </p>
      </div>
      {props.onRetry ? (
        <Button size="sm" onClick={props.onRetry}>
          <RefreshCw size={13} /> Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

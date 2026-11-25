import { MonitorSmartphone } from "lucide-solid";
import { Match, Switch } from "solid-js";

import { usePos } from "./app/PosProvider";
import { AppTopBar } from "./components/AppTopBar";
import { ShortcutFooter } from "./components/ShortcutFooter";
import type { PosScreen } from "./data/types";
import { EnrollmentScreen } from "./screens/EnrollmentScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { LockScreen } from "./screens/LockScreen";
import { OpenShiftScreen } from "./screens/OpenShiftScreen";
import { PaymentScreen } from "./screens/PaymentScreen";
import { ReceiptScreen } from "./screens/ReceiptScreen";
import { SellScreen } from "./screens/SellScreen";

const screenCopy: Record<PosScreen, { title: string; description: string }> = {
  ENROLLMENT: {
    title: "Aktivasi perangkat",
    description: "Daftarkan perangkat ke toko sebelum memulai penjualan.",
  },
  LOCK: {
    title: "Masukkan PIN",
    description: "Buka sesi kasir dengan PIN lokal perangkat.",
  },
  OPEN_SHIFT: {
    title: "Buka Shift",
    description: "Catat modal awal sebelum transaksi pertama.",
  },
  SELL: {
    title: "Jual",
    description: "Pilih produk, susun keranjang, lalu lanjut ke pembayaran.",
  },
  PAYMENT: {
    title: "Bayar",
    description: "Pilih metode pembayaran dan selesaikan transaksi.",
  },
  RECEIPT: {
    title: "Struk",
    description: "Pratinjau struk dan cetak untuk pelanggan.",
  },
  HISTORY: {
    title: "Riwayat",
    description: "Telusuri transaksi shift ini dan cetak ulang struk.",
  },
  CLOSE_SHIFT: {
    title: "Tutup Shift",
    description: "Hitung kas aktual dan selisih sebelum menutup shift.",
  },
  SYNC: {
    title: "Sinkronisasi",
    description: "Pantau antrean transaksi offline dan hasil sinkronisasi.",
  },
  SETTINGS: {
    title: "Pengaturan",
    description: "Atur tampilan, printer, pintasan, dan perangkat.",
  },
  HARD_LOCK: {
    title: "Terkunci",
    description: "Transaksi baru diblokir sampai perangkat kembali online.",
  },
};

function ScreenPlaceholder(props: { screen: PosScreen }) {
  const copy = () => screenCopy[props.screen];

  return (
    <div class="flex h-full items-center justify-center overflow-y-auto bg-canvas p-6">
      <div class="w-full max-w-md rounded-[12px] border border-line bg-surface p-8 text-center shadow-dropdown">
        <div class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <MonitorSmartphone size={22} />
        </div>
        <h1 class="text-xl font-extrabold text-ink">{copy().title}</h1>
        <p class="mt-2 text-sm text-ink-muted">{copy().description}</p>
      </div>
    </div>
  );
}

export default function App() {
  const pos = usePos();

  return (
    <div class="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <AppTopBar />

      <main class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Switch fallback={<ScreenPlaceholder screen={pos.state.screen()} />}>
          <Match when={pos.state.screen() === "ENROLLMENT"}>
            <EnrollmentScreen />
          </Match>
          <Match when={pos.state.screen() === "LOCK"}>
            <LockScreen />
          </Match>
          <Match when={pos.state.screen() === "OPEN_SHIFT"}>
            <OpenShiftScreen />
          </Match>
          <Match when={pos.state.screen() === "SELL"}>
            <SellScreen />
          </Match>
          <Match when={pos.state.screen() === "PAYMENT"}>
            <PaymentScreen />
          </Match>
          <Match when={pos.state.screen() === "RECEIPT"}>
            <ReceiptScreen />
          </Match>
          <Match when={pos.state.screen() === "HISTORY"}>
            <HistoryScreen />
          </Match>
        </Switch>
      </main>

      <ShortcutFooter />
    </div>
  );
}

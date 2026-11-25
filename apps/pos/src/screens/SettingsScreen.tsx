import {
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Switch,
  type TextSize,
  type ThemeMode,
  usePreferences,
} from "@tokojojo/ui";
import {
  ArrowLeft,
  Info,
  KeyRound,
  Printer,
  Settings2,
  ShieldCheck,
  Smartphone,
  Wifi,
} from "lucide-solid";
import type { JSX } from "solid-js";
import { createSignal, For, Show } from "solid-js";

import { usePos } from "../app/PosProvider";
import { StateChip } from "../components/StateChip";
import type { DeviceStatus } from "../data/types";

const themes: Array<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
  { value: "system", label: "Sistem" },
];

const textSizes: Array<{ value: TextSize; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Besar" },
];

const shortcuts: Array<[string, string]> = [
  ["F2", "Bayar / selesaikan pembayaran"],
  ["F3", "Fokus ke pencarian produk"],
  ["F8", "Tahan keranjang"],
  ["F9", "Buka riwayat transaksi"],
  ["F12", "Kunci layar"],
  ["Esc", "Kembali atau batalkan input"],
];

const lockTimeouts = [1, 5, 10, 15];

const statusTone: Record<DeviceStatus, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  PENDING: "warning",
  REVOKED: "danger",
};

const statusLabel: Record<DeviceStatus, string> = {
  ACTIVE: "Aktif",
  PENDING: "Menunggu",
  REVOKED: "Dicabut",
};

export function SettingsScreen() {
  const pos = usePos();
  const preferences = usePreferences();
  const [notice, setNotice] = createSignal<string | null>(null);
  const [pinOpen, setPinOpen] = createSignal(false);
  const [currentPin, setCurrentPin] = createSignal("");
  const [nextPin, setNextPin] = createSignal("");
  const [confirmPin, setConfirmPin] = createSignal("");
  const [pinError, setPinError] = createSignal<string | null>(null);

  const openPinModal = () => {
    setCurrentPin("");
    setNextPin("");
    setConfirmPin("");
    setPinError(null);
    setPinOpen(true);
  };

  const savePin = () => {
    if (currentPin() !== pos.state.settings().localPin) {
      setPinError("PIN saat ini salah.");
      return;
    }
    if (nextPin().length !== 4) {
      setPinError("PIN baru harus 4 digit.");
      return;
    }
    if (nextPin() !== confirmPin()) {
      setPinError("Konfirmasi PIN tidak cocok.");
      return;
    }

    pos.actions.saveSettings({ localPin: nextPin() });
    setPinOpen(false);
    setNotice("PIN lokal diperbarui untuk sesi demo ini.");
  };

  return (
    <div class="h-full overflow-y-auto bg-canvas p-4">
      <div class="mx-auto flex w-full max-w-[960px] flex-col gap-3">
        <div class="flex flex-wrap items-start gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary">
            <Settings2 size={21} />
          </span>
          <div class="min-w-0">
            <h1 class="text-lg font-extrabold text-ink">Pengaturan</h1>
            <p class="text-xs font-semibold text-ink-muted">
              Tampilan, printer, keamanan, dan diagnostik perangkat.
            </p>
          </div>
          <div class="ml-auto flex items-center gap-2">
            <StateChip connection={pos.state.connection()} />
            <Button
              variant="secondary"
              size="lg"
              onClick={() =>
                pos.actions.go(
                  pos.state.connection() === "LOCKED" ? "HARD_LOCK" : "SELL",
                )
              }
            >
              <ArrowLeft size={15} /> Kembali
            </Button>
          </div>
        </div>

        <Show when={notice()}>
          <p
            role="status"
            class="rounded-[6px] bg-success-soft px-3 py-2 text-xs font-bold text-success"
          >
            {notice()}
          </p>
        </Show>

        <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Section
            title="Tampilan"
            icon={<Smartphone size={17} />}
            description="Berlaku langsung di perangkat ini."
          >
            <FieldLabel text="Tema" />
            <Segment
              options={themes}
              value={preferences.theme()}
              onChange={(value) => preferences.setTheme(value as ThemeMode)}
            />
            <div class="mt-3">
              <FieldLabel text="Ukuran teks" />
              <Segment
                options={textSizes}
                value={preferences.textSize()}
                onChange={(value) => preferences.setTextSize(value as TextSize)}
              />
            </div>
            <p class="mt-2 rounded-[6px] bg-subtle px-2.5 py-1.5 text-[0.6875rem] font-semibold text-ink-secondary">
              Pratinjau teks{" "}
              {preferences.textSize() === "large" ? "Besar" : "Normal"} · Total
              Rp 166.500
            </p>
          </Section>

          <Section
            title="Printer & Struk"
            icon={<Printer size={17} />}
            description="Pratinjau dan auto-print struk."
          >
            <FieldLabel text="Ukuran kertas" />
            <Segment
              options={[
                { value: "58mm", label: "58 mm" },
                { value: "80mm", label: "80 mm" },
              ]}
              value={pos.state.settings().paperSize}
              onChange={(value) =>
                pos.actions.saveSettings({
                  paperSize: value as "58mm" | "80mm",
                })
              }
            />
            <div class="mt-3 flex items-center gap-3 rounded-[6px] border border-line px-2.5 py-2">
              <div class="min-w-0 flex-1">
                <div class="text-xs font-bold text-ink">Auto-print struk</div>
                <div class="text-[0.625rem] font-semibold text-ink-muted">
                  Cetak otomatis setelah pembayaran selesai.
                </div>
              </div>
              <Switch
                checked={pos.state.settings().autoPrint}
                onChange={(value) =>
                  pos.actions.saveSettings({ autoPrint: value })
                }
                label="Auto-print struk"
              />
            </div>
            <Button
              variant="secondary"
              size="lg"
              class="mt-2"
              onClick={() => setNotice("Tes cetak dikirim ke printer demo.")}
            >
              <Printer size={14} /> Tes cetak
            </Button>
          </Section>

          <Section
            title="Pintasan"
            icon={<Info size={17} />}
            description="Keyboard-first saat layar Jual aktif."
          >
            <div class="space-y-1">
              <For each={shortcuts}>
                {([key, label]) => (
                  <div class="flex items-center gap-2">
                    <kbd class="min-w-9 rounded-[3px] border border-line bg-subtle px-1 py-0.5 text-center font-mono text-[0.625rem] font-bold text-ink-secondary">
                      {key}
                    </kbd>
                    <span class="text-[0.6875rem] font-semibold text-ink-secondary">
                      {label}
                    </span>
                  </div>
                )}
              </For>
            </div>
            <p class="mt-2 text-[0.625rem] font-semibold text-ink-muted">
              Pintasan diabaikan saat mengetik di kolom input, kecuali Esc.
            </p>
          </Section>

          <Section
            title="Keamanan"
            icon={<ShieldCheck size={17} />}
            description="PIN lokal dan kunci otomatis."
          >
            <div class="flex items-center gap-3 rounded-[6px] border border-line px-2.5 py-2">
              <KeyRound size={16} class="shrink-0 text-primary" />
              <div class="min-w-0 flex-1">
                <div class="text-xs font-bold text-ink">PIN lokal</div>
                <div class="font-mono text-[0.6875rem] text-ink-muted">
                  ••••
                </div>
              </div>
              <Button variant="secondary" size="lg" onClick={openPinModal}>
                Ubah PIN
              </Button>
            </div>
            <div class="mt-2">
              <FieldLabel text="Kunci otomatis" />
              <Select
                id="lock-timeout"
                aria-label="Kunci otomatis"
                style={{ height: "44px" }}
                value={String(pos.state.settings().lockTimeoutMinutes)}
                onChange={(event) =>
                  pos.actions.saveSettings({
                    lockTimeoutMinutes: Number(event.currentTarget.value),
                  })
                }
              >
                <For each={lockTimeouts}>
                  {(minutes) => (
                    <option value={String(minutes)}>{minutes} menit</option>
                  )}
                </For>
              </Select>
            </div>
            <p class="mt-2 text-[0.625rem] font-semibold text-ink-muted">
              PIN lokal hanya membuka sesi perangkat, bukan kredensial server.
            </p>
          </Section>

          <Section
            title="Perangkat & Sinkronisasi"
            icon={<Wifi size={17} />}
            description="Diagnostik tanpa menampilkan token."
          >
            <div class="space-y-1.5 text-[0.6875rem]">
              <Row label="Perangkat" value={pos.state.device().name} mono />
              <Row label="Platform" value={pos.state.device().platform} />
              <div class="flex items-center justify-between gap-3">
                <span class="text-ink-muted">Status</span>
                <Badge tone={statusTone[pos.state.device().status]}>
                  {statusLabel[pos.state.device().status]}
                </Badge>
              </div>
              <Row
                label="Terakhir sinkron"
                value={pos.state.queue().lastSync}
              />
              <Row
                label="Antrean"
                value={`${pos.state.queue().pending} transaksi`}
                mono
              />
              <Row label="Token offline" value="Tidak ditampilkan" />
            </div>
            <Button
              variant="secondary"
              size="lg"
              class="mt-2"
              onClick={() => pos.actions.go("SYNC")}
            >
              <Wifi size={14} /> Buka sinkronisasi
            </Button>
          </Section>

          <Section
            title="Tentang"
            icon={<Info size={17} />}
            description="Versi dan batasan build demo."
          >
            <div class="space-y-1 text-[0.6875rem] text-ink-secondary">
              <p class="font-bold text-ink">TokoJoJo POS · UI mock v0.1.0</p>
              <p>Tauri 2.12 · SolidJS · Vite · Tailwind CSS</p>
              <p>
                Design system Pandan/Kunyit · Plus Jakarta Sans + IBM Plex Mono.
              </p>
              <p class="font-semibold text-ink-muted">
                Data demo hanya tersimpan di memori. Tidak ada auth, SQLite,
                outbox, atau sinkronisasi server pada build ini.
              </p>
            </div>
          </Section>
        </div>
      </div>

      <Modal
        open={pinOpen()}
        onOpenChange={setPinOpen}
        title="Ubah PIN lokal"
        description="PIN ini hanya membuka sesi perangkat."
        size="sm"
        footer={
          <>
            <Button size="lg" onClick={() => setPinOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="lg" onClick={savePin}>
              Simpan PIN
            </Button>
          </>
        }
      >
        <div class="flex flex-col gap-2.5">
          <PinField
            id="current-pin"
            label="PIN saat ini"
            value={currentPin()}
            onInput={setCurrentPin}
          />
          <PinField
            id="new-pin"
            label="PIN baru"
            value={nextPin()}
            onInput={setNextPin}
          />
          <PinField
            id="confirm-pin"
            label="Konfirmasi PIN baru"
            value={confirmPin()}
            onInput={setConfirmPin}
          />
          <Show when={pinError()}>
            <p class="text-xs font-bold text-danger">{pinError()}</p>
          </Show>
          <p class="text-[0.625rem] font-semibold text-ink-muted">
            Demo: PIN awal 4321. Perubahan berlaku sampai aplikasi dimuat ulang.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function Section(props: {
  title: string;
  icon: JSX.Element;
  description: string;
  children: JSX.Element;
}) {
  return (
    <section class="rounded-[10px] border border-line bg-surface">
      <div class="flex items-center gap-2 border-b border-line px-3 py-2">
        <span class="text-primary">{props.icon}</span>
        <div class="min-w-0">
          <h2 class="text-xs font-extrabold text-ink">{props.title}</h2>
          <p class="text-[0.625rem] font-semibold text-ink-muted">
            {props.description}
          </p>
        </div>
      </div>
      <div class="px-3 py-2.5">{props.children}</div>
    </section>
  );
}

function FieldLabel(props: { text: string }) {
  return (
    <div class="mb-1 text-[0.625rem] font-extrabold tracking-[0.08em] text-ink-muted uppercase">
      {props.text}
    </div>
  );
}

function Segment(props: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div class="flex gap-1 rounded-[6px] border border-line bg-subtle p-1">
      <For each={props.options}>
        {(option) => (
          <button
            type="button"
            aria-pressed={props.value === option.value}
            onClick={() => props.onChange(option.value)}
            class={`h-11 flex-1 cursor-pointer rounded-[4px] text-[0.6875rem] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              props.value === option.value
                ? "bg-surface text-primary shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  );
}

function Row(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div class="flex items-center justify-between gap-3">
      <span class="text-ink-muted">{props.label}</span>
      <span
        class={`truncate font-semibold text-ink ${props.mono ? "font-mono text-[0.625rem]" : ""}`}
      >
        {props.value}
      </span>
    </div>
  );
}

function PinField(props: {
  id: string;
  label: string;
  value: string;
  onInput: (value: string) => void;
}) {
  return (
    <div>
      <label
        for={props.id}
        class="text-[0.6875rem] font-bold text-ink-secondary"
      >
        {props.label}
      </label>
      <Input
        id={props.id}
        type="password"
        inputmode="numeric"
        autocomplete="off"
        maxLength={4}
        value={props.value}
        onInput={(event) =>
          props.onInput(
            event.currentTarget.value.replace(/\D/g, "").slice(0, 4),
          )
        }
        class="mt-1 h-11 font-mono"
      />
    </div>
  );
}

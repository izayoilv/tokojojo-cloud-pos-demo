import { Button, Input } from "@tokojojo/ui";
import { KeyRound, Lock, ShieldCheck } from "lucide-solid";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { usePos } from "../app/PosProvider";
import { PinPad } from "../components/PinPad";
import { demoUsers } from "../data/mock";
import type { UserSession } from "../data/types";

const initials = (user: UserSession) =>
  user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function LockScreen() {
  const pos = usePos();
  const [pin, setPin] = createSignal("");
  const [passwordMode, setPasswordMode] = createSignal(false);
  const [password, setPassword] = createSignal("");
  const [userPickerOpen, setUserPickerOpen] = createSignal(false);
  const [now, setNow] = createSignal(Date.now());

  const selectedUser = () => pos.state.selectedUser();
  const remainingMs = () =>
    Math.max(0, (pos.state.pinLockedUntil() ?? 0) - now());
  const lockedOut = () => remainingMs() > 0 || pos.state.pinAttempts() >= 10;
  const shiftActive = () => pos.state.shift()?.status === "OPEN";

  const submitPin = (value: string) => {
    pos.actions.unlockPin(value);
    setPin("");
  };

  const pushDigit = (digit: string) => {
    if (lockedOut()) return;
    const next = `${pin()}${digit}`.slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      submitPin(next);
    }
  };

  onMount(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => window.clearInterval(timer));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "Escape") {
        setPin("");
        setPasswordMode(false);
        return;
      }
      if (passwordMode()) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        pushDigit(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setPin((current) => current.slice(0, -1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <div class="flex h-full items-start justify-center overflow-y-auto bg-canvas p-4">
      <div class="my-auto w-full max-w-[400px] rounded-[12px] border border-line bg-surface p-4 shadow-modal">
        <div class="flex items-center gap-2.5 border-b border-line pb-3">
          <span class="relative flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-primary text-sm font-extrabold text-on-primary">
            TJ
            <span class="absolute -top-1 -right-1 size-2 rounded-[2px] bg-accent" />
          </span>
          <div class="min-w-0">
            <div class="text-xs font-extrabold tracking-[0.06em] text-ink">
              TOKO JOJO
            </div>
            <div class="text-sm font-semibold text-ink-muted">
              POS Terminal · Kasir
            </div>
          </div>
        </div>

        <div class="mt-3 flex items-center gap-2.5 rounded-[8px] bg-subtle p-2.5">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
            {initials(selectedUser())}
          </span>
          <div class="min-w-0">
            <div class="truncate text-sm font-bold text-ink">
              {selectedUser().name}
            </div>
            <div class="text-sm font-semibold tracking-[0.04em] text-ink-muted uppercase">
              {selectedUser().role === "CASHIER"
                ? "Kasir"
                : selectedUser().role === "ADMIN"
                  ? "Admin"
                  : "Owner"}{" "}
              · {shiftActive() ? "Shift aktif" : "Belum ada shift"}
            </div>
          </div>
          <Lock size={15} class="ml-auto shrink-0 text-ink-muted" />
        </div>

        <h1 class="mt-3 text-center text-xl font-extrabold text-ink">
          Masukkan PIN
        </h1>
        <p class="mt-0.5 text-center text-xs text-ink-muted">
          Empat digit PIN lokal perangkat
        </p>

        <div
          class="mt-3 flex justify-center gap-2"
          aria-label={`PIN ${pin().length} dari 4 digit`}
        >
          <For each={[0, 1, 2, 3]}>
            {(index) => (
              <span
                class={`size-3.5 rounded-full border-2 ${
                  index < pin().length
                    ? "border-primary bg-primary"
                    : "border-line-control bg-surface"
                } ${pos.state.pinError() ? "border-danger" : ""}`}
              />
            )}
          </For>
        </div>

        <div class="mt-1.5 min-h-5 text-center" role="alert">
          <Show when={remainingMs() > 0}>
            <span class="text-xs font-bold text-danger">
              Coba lagi dalam {Math.floor(Math.ceil(remainingMs() / 1000) / 60)}
              :{String(Math.ceil(remainingMs() / 1000) % 60).padStart(2, "0")}
            </span>
          </Show>
          <Show
            when={
              remainingMs() === 0 && pos.state.pinError() && pin().length === 0
            }
          >
            <span class="text-xs font-bold text-danger">
              {pos.state.pinError()}
            </span>
          </Show>
        </div>

        <Show
          when={!passwordMode()}
          fallback={
            <form
              class="mt-1 flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                pos.actions.unlockWithPassword(password());
                setPassword("");
              }}
            >
              <Input
                type="password"
                autocomplete="current-password"
                placeholder="Kata sandi"
                aria-label="Kata sandi"
                value={password()}
                onInput={(event) => setPassword(event.currentTarget.value)}
                autofocus
                style={{ height: "44px" }}
              />
              <Button variant="primary" size="lg" type="submit" full>
                Masuk dengan kata sandi
              </Button>
            </form>
          }
        >
          <PinPad
            disabled={lockedOut()}
            onDigit={pushDigit}
            onClear={() => setPin("")}
            onBackspace={() => setPin((current) => current.slice(0, -1))}
          />
        </Show>

        <div class="mt-2 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setPasswordMode((value) => !value);
              setPin("");
              setPassword("");
            }}
            class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-[4px] px-2 text-sm font-bold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <KeyRound size={13} />
            {passwordMode() ? "Kembali ke PIN" : "Masuk dengan kata sandi"}
          </button>

          <Show when={import.meta.env.DEV}>
            <button
              type="button"
              aria-expanded={userPickerOpen()}
              onClick={() => setUserPickerOpen((value) => !value)}
              class="h-11 cursor-pointer rounded-[4px] px-2 text-sm font-semibold text-ink-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {userPickerOpen() ? "Tutup pilihan pengguna" : "Ganti pengguna"}
            </button>
          </Show>

          <Show when={import.meta.env.DEV && userPickerOpen()}>
            <div class="w-full space-y-1 rounded-[6px] border border-line bg-subtle p-2">
              <For each={demoUsers}>
                {(user) => (
                  <button
                    type="button"
                    onClick={() => {
                      pos.actions.selectUser(user);
                      setUserPickerOpen(false);
                      setPin("");
                      setPassword("");
                      setPasswordMode(false);
                    }}
                    class={`flex w-full cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      selectedUser().username === user.username
                        ? "bg-surface font-bold text-ink"
                        : "text-ink-secondary"
                    }`}
                  >
                    <span class="flex size-6 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                      {initials(user)}
                    </span>
                    <span class="min-w-0">
                      <span class="block truncate">{user.name}</span>
                      <span class="block text-sm text-ink-muted uppercase">
                        {user.role}
                      </span>
                    </span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="mt-2 flex items-start gap-1.5 border-t border-line pt-2.5">
          <ShieldCheck size={13} class="mt-0.5 shrink-0 text-ink-muted" />
          <p class="text-sm leading-relaxed text-ink-muted">
            PIN lokal hanya membuka sesi perangkat, bukan kredensial server.
          </p>
        </div>

        <Show when={import.meta.env.DEV}>
          <p class="mt-1.5 text-center text-sm font-semibold text-ink-muted">
            Hanya untuk demo: PIN awal 4321 · Kata sandi tokojojo
          </p>
        </Show>
      </div>
    </div>
  );
}

import { Button, Input } from "@tokojojo/ui";
import { KeyRound, Lock, ShieldCheck } from "lucide-solid";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { usePos } from "../app/PosProvider";
import { PinPad } from "../components/PinPad";
import { demoUser } from "../data/mock";

const initials = demoUser.name
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
  const [userNote, setUserNote] = createSignal<string | null>(null);

  const lockedOut = () => pos.state.pinAttempts() >= 5;
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
          <span class="relative flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-primary text-[0.625rem] font-extrabold text-on-primary">
            TJ
            <span class="absolute -top-1 -right-1 size-2 rounded-[2px] bg-accent" />
          </span>
          <div class="min-w-0">
            <div class="text-xs font-extrabold tracking-[0.06em] text-ink">
              TOKO JOJO
            </div>
            <div class="text-[0.625rem] font-semibold text-ink-muted">
              POS Terminal · Kasir
            </div>
          </div>
        </div>

        <div class="mt-3 flex items-center gap-2.5 rounded-[8px] bg-subtle p-2.5">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
            {initials}
          </span>
          <div class="min-w-0">
            <div class="truncate text-sm font-bold text-ink">
              {demoUser.name}
            </div>
            <div class="text-[0.625rem] font-semibold tracking-[0.04em] text-ink-muted uppercase">
              {demoUser.role === "CASHIER"
                ? "Kasir"
                : demoUser.role === "ADMIN"
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
          <Show when={pos.state.pinError() && pin().length === 0}>
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
            class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-[4px] px-2 text-xs font-bold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <KeyRound size={13} />
            {passwordMode() ? "Kembali ke PIN" : "Masuk dengan kata sandi"}
          </button>

          <button
            type="button"
            onClick={() => {
              setPin("");
              setUserNote("Demo hanya menyediakan satu kasir.");
            }}
            class="h-11 cursor-pointer rounded-[4px] px-2 text-xs font-semibold text-ink-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Ganti pengguna
          </button>

          <Show when={userNote()}>
            <p class="text-[0.625rem] font-semibold text-ink-muted">
              {userNote()}
            </p>
          </Show>
        </div>

        <div class="mt-2 flex items-start gap-1.5 border-t border-line pt-2.5">
          <ShieldCheck size={13} class="mt-0.5 shrink-0 text-ink-muted" />
          <p class="text-[0.625rem] leading-relaxed text-ink-muted">
            PIN lokal hanya membuka sesi perangkat, bukan kredensial server.
          </p>
        </div>

        <p class="mt-1.5 text-center text-[0.625rem] font-semibold text-ink-muted">
          Demo: PIN awal 4321 · Kata sandi tokojojo
        </p>
      </div>
    </div>
  );
}

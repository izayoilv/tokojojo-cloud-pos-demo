import { useNavigate } from "@solidjs/router";
import { KeyRound, LogIn, UserRound } from "lucide-solid";
import { createEffect, createSignal, For, Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { roleMeta } from "../../app/rbac";
import { useToast } from "../../app/toast";
import { Field, inputClass } from "../../components/ui/Field";
import { demoPassword, users } from "../../data/mock";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [username, setUsername] = createSignal("owner");
  const [password, setPassword] = createSignal(demoPassword);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    if (auth.user()) {
      navigate("/", { replace: true });
    }
  });

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await auth.login(username(), password());
      toast.notify(`Selamat datang, ${auth.user()?.name ?? username()}`);
      navigate("/", { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Tidak dapat masuk saat ini.",
      );
    } finally {
      setLoading(false);
    }
  };

  const pickUser = (user: (typeof users)[number]) => {
    setUsername(user.username);
    setPassword(demoPassword);
    setError("");
  };

  return (
    <div class="flex min-h-dvh items-center justify-center bg-[linear-gradient(150deg,#0F2447,#16315E_55%,#1D4ED8_140%)] px-4 py-8">
      <div class="w-full max-w-[400px] rounded-2xl bg-white px-6 py-8 shadow-[0_24px_60px_rgba(0,0,0,.35)] sm:px-9">
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex size-[60px] items-center justify-center rounded-[15px] bg-navy text-[22px] font-extrabold text-white">
            TJ
          </div>
          <h1 class="text-[19px] font-extrabold tracking-[.03em] text-ink">
            TOKO JOJO MANAGEMENT SYSTEM
          </h1>
          <p class="mt-1 text-xs text-muted">
            Sistem Administrasi Bisnis &amp; Inventaris &bull; Web Admin
          </p>
        </div>

        <form onSubmit={submit} novalidate>
          <Field label="Username Karyawan">
            <div class="relative">
              <UserRound
                size={15}
                class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
              />
              <input
                class={`${inputClass} pl-9`}
                value={username()}
                autocomplete="username"
                placeholder="owner"
                onInput={(event) => setUsername(event.currentTarget.value)}
              />
            </div>
          </Field>

          <Field label="Kata Sandi">
            <div class="relative">
              <KeyRound
                size={15}
                class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
              />
              <input
                type="password"
                class={`${inputClass} pl-9`}
                value={password()}
                autocomplete="current-password"
                placeholder="••••••••"
                onInput={(event) => setPassword(event.currentTarget.value)}
              />
            </div>
          </Field>

          <Show when={error()}>
            <div
              role="alert"
              class="mb-3.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-danger"
            >
              {error()}
            </div>
          </Show>

          <button
            type="submit"
            disabled={loading()}
            class="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[9px] bg-royal text-[13px] font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Show
              when={!loading()}
              fallback={
                <span class="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              }
            >
              <LogIn size={16} /> Masuk ke Sistem
            </Show>
          </button>
        </form>

        <div class="mt-4 rounded-[11px] border border-line bg-canvas p-3">
          <div class="mb-2 text-[11px] font-bold text-muted">
            PILIH PERAN DEMO (RBAC):
          </div>
          <div class="grid grid-cols-1 gap-[7px] sm:grid-cols-2">
            <For each={users}>
              {(user) => (
                <button
                  type="button"
                  onClick={() => pickUser(user)}
                  class="cursor-pointer rounded-lg border border-line bg-white px-2.5 py-[7px] text-left text-xs font-semibold transition-colors hover:border-royal hover:bg-blue-50"
                >
                  <span class="flex items-center justify-between gap-1">
                    {user.username}
                    <span
                      class="rounded-full px-1.5 py-px text-[9px] font-extrabold"
                      style={{
                        background: `${roleMeta[user.role].color}18`,
                        color: roleMeta[user.role].color,
                      }}
                    >
                      {user.role}
                    </span>
                  </span>
                  <span class="mt-0.5 block text-[10px] font-medium text-faint">
                    {user.name}
                  </span>
                </button>
              )}
            </For>
          </div>
          <p class="mt-2.5 text-[10.5px] text-faint">
            Kata sandi demo: <span class="font-semibold">{demoPassword}</span>{" "}
            &middot; sesi hanya tersimpan di memori dan hilang saat halaman
            dimuat ulang.
          </p>
        </div>
      </div>
    </div>
  );
}

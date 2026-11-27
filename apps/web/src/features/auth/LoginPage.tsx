import { useNavigate } from "@solidjs/router";
import { Button, Field, Input, Panel, useToast } from "@tokojojo/ui";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-solid";
import { createEffect, createSignal, For, Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { roleMeta } from "../../app/rbac";
import { demoPassword, users } from "../../data/mock";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [showPassword, setShowPassword] = createSignal(false);
  const [showDemo, setShowDemo] = createSignal(false);
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
          : "Tidak bisa menghubungi server. Coba lagi.",
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
    <div class="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div class="w-full max-w-[420px]">
        <div class="mb-6 text-center">
          <span class="relative mx-auto flex size-14 items-center justify-center rounded-[12px] bg-primary text-lg font-extrabold text-on-primary">
            TJ
            <span class="absolute -top-1.5 -right-1.5 size-3.5 rounded-[3px] bg-accent" />
          </span>
          <h1 class="mt-4 text-2xl font-extrabold tracking-tight text-ink">
            <span class="font-semibold">Toko</span>
            <span class="font-extrabold">Jojo</span>
          </h1>
          <p class="mt-1 text-sm text-ink-muted">
            Sistem Administrasi Bisnis &amp; Inventaris
          </p>
        </div>

        <Panel class="p-6 sm:p-7">
          <h2 class="text-xl font-bold text-ink">Masuk ke TokoJoJo</h2>
          <p class="mt-1 text-sm text-ink-muted">Gunakan akun karyawan toko.</p>

          <form class="mt-5 space-y-4" onSubmit={submit} novalidate>
            <Field label="Username" htmlFor="login-username" required>
              <Input
                id="login-username"
                value={username()}
                autocomplete="username"
                placeholder="cth: owner"
                onInput={(event) => setUsername(event.currentTarget.value)}
              />
            </Field>

            <Field label="Password" htmlFor="login-password" required>
              <div class="relative">
                <Input
                  id="login-password"
                  type={showPassword() ? "text" : "password"}
                  value={password()}
                  autocomplete="current-password"
                  class="pr-10"
                  onInput={(event) => setPassword(event.currentTarget.value)}
                />
                <button
                  type="button"
                  aria-label={
                    showPassword()
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                  class="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[4px] text-ink-muted hover:bg-subtle hover:text-ink"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword() ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <Show when={error()}>
              <div
                role="alert"
                class="rounded-[6px] border border-danger/20 bg-danger-soft px-3 py-2 text-sm font-semibold text-danger"
              >
                {error()}
              </div>
            </Show>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              full
              loading={loading()}
            >
              <LogIn size={16} /> Masuk
            </Button>
          </form>

          <button
            type="button"
            class="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink"
            onClick={() => setShowDemo((value) => !value)}
          >
            <ShieldCheck size={14} />
            {showDemo() ? "Sembunyikan akun demo" : "Akun demo"}
          </button>

          <Show when={showDemo()}>
            <div class="mt-3 rounded-[6px] border border-line bg-subtle p-3">
              <p class="mb-2 text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                Pilih peran demo
              </p>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <For each={users}>
                  {(user) => (
                    <button
                      type="button"
                      onClick={() => pickUser(user)}
                      class="cursor-pointer rounded-[6px] border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:border-primary hover:bg-primary-soft"
                    >
                      <span class="flex items-center justify-between gap-2 text-xs font-bold text-ink">
                        {user.username}
                        <span
                          class="rounded-full px-1.5 py-px text-[10px] font-extrabold"
                          style={{
                            background: `${roleMeta[user.role].color}18`,
                            color: roleMeta[user.role].color,
                          }}
                        >
                          {user.role}
                        </span>
                      </span>
                      <span class="mt-0.5 block text-[11px] text-ink-muted">
                        {user.name}
                      </span>
                    </button>
                  )}
                </For>
              </div>
              <p class="mt-2 text-[11px] text-ink-muted">
                Password demo: <b>{demoPassword}</b>
              </p>
            </div>
          </Show>
        </Panel>
      </div>
    </div>
  );
}

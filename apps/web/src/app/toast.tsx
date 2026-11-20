import type { JSX } from "solid-js";
import { createContext, createSignal, For, useContext } from "solid-js";

type Tone = "ok" | "warn" | "err";
type Toast = { id: number; message: string; tone: Tone };

type ToastContextValue = {
  notify: (message: string, tone?: Tone) => void;
};

const ToastContext = createContext<ToastContextValue>();

const tones: Record<Tone, string> = {
  ok: "border-l-success",
  warn: "border-l-warning",
  err: "border-l-danger",
};

export function ToastProvider(props: { children: JSX.Element }) {
  const [toasts, setToasts] = createSignal<Toast[]>([]);
  let nextId = 1;

  const notify = (message: string, tone: Tone = "ok") => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3400);
  };

  return (
    <ToastContext.Provider value={{ notify }}>
      {props.children}
      <div class="fixed right-4 bottom-4 z-[400] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2">
        <For each={toasts()}>
          {(toast) => (
            <div
              class={`animate-[slide-in_.2s_ease-out] rounded-xl border-l-4 bg-navy px-4 py-3 text-xs font-semibold text-white shadow-xl ${tones[toast.tone]}`}
            >
              {toast.message}
            </div>
          )}
        </For>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}

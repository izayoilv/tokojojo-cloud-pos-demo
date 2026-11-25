import { X } from "lucide-solid";
import type { JSX } from "solid-js";
import { createContext, createSignal, For, Show, useContext } from "solid-js";

type ToastTone = "success" | "warning" | "danger" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  notify: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue>();

const tones: Record<ToastTone, string> = {
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-danger",
  info: "border-l-info",
};

export function ToastProvider(props: { children: JSX.Element }) {
  const [items, setItems] = createSignal<ToastItem[]>([]);
  let nextId = 1;

  const dismiss = (id: number) =>
    setItems((current) => current.filter((item) => item.id !== id));

  const notify = (message: string, tone: ToastTone = "success") => {
    const id = nextId++;
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4200);
  };

  return (
    <ToastContext.Provider value={{ notify }}>
      {props.children}
      <div
        class="fixed right-4 bottom-4 z-[400] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
      >
        <For each={items()}>
          {(item) => (
            <div
              class={`flex items-start gap-3 rounded-[8px] border-l-4 bg-ink px-4 py-3 text-sm font-semibold text-ink-inverse shadow-toast ${tones[item.tone]}`}
            >
              <span class="flex-1">{item.message}</span>
              <button
                type="button"
                aria-label="Tutup notifikasi"
                class="cursor-pointer opacity-70 hover:opacity-100"
                onClick={() => dismiss(item.id)}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </For>
        <Show when={items().length === 0}>
          <span class="sr-only">Tidak ada notifikasi</span>
        </Show>
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

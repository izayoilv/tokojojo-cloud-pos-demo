import { Dialog } from "@kobalte/core/dialog";
import { X } from "lucide-solid";
import type { JSX } from "solid-js";
import { createEffect, Show } from "solid-js";

export function Modal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: JSX.Element;
  footer?: JSX.Element;
  size?: "sm" | "md" | "lg";
}) {
  const widths = {
    sm: "max-w-[480px]",
    md: "max-w-[640px]",
    lg: "max-w-[800px]",
  };

  createEffect(() => {
    if (!props.open && typeof document !== "undefined") {
      document.body.style.pointerEvents = "";
    }
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[200] bg-[var(--tj-overlay)]" />
        <div class="pointer-events-none fixed inset-0 z-[201] flex items-center justify-center p-4">
          <Dialog.Content
            class={`pointer-events-auto flex max-h-[90vh] w-full flex-col rounded-[12px] border border-line bg-surface shadow-modal outline-none ${widths[props.size ?? "md"]}`}
          >
            <div class="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div class="min-w-0">
                <Dialog.Title class="text-lg font-bold text-ink">
                  {props.title}
                </Dialog.Title>
                <Show when={props.description}>
                  <p class="mt-0.5 text-xs text-ink-muted">
                    {props.description}
                  </p>
                </Show>
              </div>
              <Dialog.CloseButton
                aria-label="Tutup"
                class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <X size={18} />
              </Dialog.CloseButton>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {props.children}
            </div>
            <Show when={props.footer}>
              <div class="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
                {props.footer}
              </div>
            </Show>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}

export function Drawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: JSX.Element;
  footer?: JSX.Element;
}) {
  createEffect(() => {
    if (!props.open && typeof document !== "undefined") {
      document.body.style.pointerEvents = "";
    }
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[200] bg-[var(--tj-overlay)]" />
        <div class="pointer-events-none fixed inset-y-0 right-0 z-[201] flex w-full max-w-[480px] p-2">
          <Dialog.Content class="pointer-events-auto flex h-full w-full flex-col rounded-[12px] border border-line bg-surface shadow-modal outline-none">
            <div class="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <Dialog.Title class="text-lg font-bold text-ink">
                  {props.title}
                </Dialog.Title>
                <Show when={props.description}>
                  <p class="mt-0.5 text-xs text-ink-muted">
                    {props.description}
                  </p>
                </Show>
              </div>
              <Dialog.CloseButton
                aria-label="Tutup"
                class="flex size-8 cursor-pointer items-center justify-center rounded-[6px] text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <X size={18} />
              </Dialog.CloseButton>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {props.children}
            </div>
            <Show when={props.footer}>
              <div class="flex justify-end gap-2 border-t border-line px-5 py-3">
                {props.footer}
              </div>
            </Show>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}

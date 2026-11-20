import { Dialog } from "@kobalte/core/dialog";
import { X } from "lucide-solid";
import type { JSX } from "solid-js";
import { Show } from "solid-js";

export function Modal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: JSX.Element;
  footer?: JSX.Element;
  size?: "md" | "lg";
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-[2px]" />
        <div class="pointer-events-none fixed inset-0 z-[201] flex items-center justify-center p-4">
          <Dialog.Content
            class={`pointer-events-auto flex max-h-[90vh] w-full flex-col rounded-[14px] bg-white shadow-2xl outline-none ${
              props.size === "lg" ? "max-w-[840px]" : "max-w-[620px]"
            }`}
          >
            <div class="flex items-center justify-between border-b border-line px-5 py-3.5">
              <Dialog.Title class="text-[15px] font-extrabold text-ink">
                {props.title}
              </Dialog.Title>
              <Dialog.CloseButton
                aria-label="Tutup"
                class="flex size-[30px] cursor-pointer items-center justify-center rounded-lg bg-canvas text-muted transition hover:bg-slate-200 hover:text-ink"
              >
                <X size={16} />
              </Dialog.CloseButton>
            </div>
            <div class="overflow-y-auto px-5 py-[18px]">{props.children}</div>
            <Show when={props.footer}>
              <div class="flex flex-wrap justify-end gap-2.5 border-t border-line px-5 py-3.5">
                {props.footer}
              </div>
            </Show>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}

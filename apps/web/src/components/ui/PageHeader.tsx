import type { JSX } from "solid-js";
import { Show } from "solid-js";

export function PageHeader(props: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: JSX.Element;
}) {
  return (
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-white px-[18px] py-3.5 shadow-sm">
      <div class="min-w-0">
        <Show when={props.eyebrow}>
          <div class="text-[11px] text-muted">{props.eyebrow}</div>
        </Show>
        <h2 class="mt-0.5 text-base font-extrabold text-ink">{props.title}</h2>
        <Show when={props.subtitle}>
          <div class="mt-0.5 text-[11.5px] text-muted">{props.subtitle}</div>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="flex flex-wrap items-center gap-2.5">{props.actions}</div>
      </Show>
    </div>
  );
}

import type { JSX } from "solid-js";
import { Show } from "solid-js";

export const inputClass =
  "h-10 w-full rounded-[9px] border-[1.5px] border-line bg-white px-3 text-[13px] text-ink outline-none transition focus:border-royal focus:ring-3 focus:ring-royal/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted";

export function Field(props: {
  label: string;
  hint?: string;
  error?: string;
  children: JSX.Element;
  class?: string;
}) {
  return (
    <div class={`mb-3.5 ${props.class ?? ""}`}>
      <label class="mb-1.5 block text-[11px] font-bold tracking-[.05em] text-muted uppercase">
        {props.label}
      </label>
      {props.children}
      <Show when={props.hint}>
        <div class="mt-1 text-[11px] text-faint">{props.hint}</div>
      </Show>
      <Show when={props.error}>
        <div class="mt-1 text-[11px] font-semibold text-danger">
          {props.error}
        </div>
      </Show>
    </div>
  );
}

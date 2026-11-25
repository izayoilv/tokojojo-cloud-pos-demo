import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";

export function Panel(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);

  return (
    <div
      {...rest}
      class={`rounded-[8px] border border-line bg-surface ${local.class ?? ""}`}
    >
      {local.children}
    </div>
  );
}

export function PanelHeader(props: {
  title: string;
  description?: string;
  actions?: JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={`flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 ${props.class ?? ""}`}
    >
      <div class="min-w-0">
        <h2 class="text-base font-bold text-ink">{props.title}</h2>
        <Show when={props.description}>
          <p class="mt-0.5 text-xs text-ink-muted">{props.description}</p>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="flex flex-wrap items-center gap-2">{props.actions}</div>
      </Show>
    </div>
  );
}

export function PanelBody(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);

  return (
    <div {...rest} class={`p-4 ${local.class ?? ""}`}>
      {local.children}
    </div>
  );
}

export function PanelFooter(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);

  return (
    <div
      {...rest}
      class={`flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 ${local.class ?? ""}`}
    >
      {local.children}
    </div>
  );
}

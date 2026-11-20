import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);

  return (
    <div
      {...rest}
      class={`rounded-[10px] border border-line bg-white shadow-[0_1px_3px_rgba(15,23,42,.07),0_1px_2px_rgba(15,23,42,.05)] ${local.class ?? ""}`}
    >
      {local.children}
    </div>
  );
}

export function CardHeader(props: {
  title: string;
  subtitle?: string;
  actions?: JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={`flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-[18px] py-3.5 ${props.class ?? ""}`}
    >
      <div class="min-w-0">
        <h3 class="text-sm font-extrabold text-ink">{props.title}</h3>
        <Show when={props.subtitle}>
          <div class="mt-px text-[11.5px] font-medium text-muted">
            {props.subtitle}
          </div>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="flex flex-wrap items-center gap-2">{props.actions}</div>
      </Show>
    </div>
  );
}

export function CardBody(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);

  return (
    <div {...rest} class={`px-[18px] py-4 ${local.class ?? ""}`}>
      {local.children}
    </div>
  );
}

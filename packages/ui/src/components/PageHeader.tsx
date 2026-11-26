import type { JSX } from "solid-js";
import { Show } from "solid-js";

export function PageHeader(props: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={`mb-4 flex flex-wrap items-end justify-between gap-4 ${props.class ?? ""}`}
    >
      <div class="min-w-0">
        <Show when={props.eyebrow}>
          <p class="text-xs font-bold tracking-[0.06em] text-ink-muted uppercase">
            {props.eyebrow}
          </p>
        </Show>
        <h1 class="mt-0.5 text-2xl font-extrabold tracking-[-0.01em] text-ink">
          {props.title}
        </h1>
        <Show when={props.subtitle}>
          <p class="mt-1 text-sm text-ink-muted">{props.subtitle}</p>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="flex flex-wrap items-center gap-2">{props.actions}</div>
      </Show>
    </div>
  );
}

export function SectionTitle(props: {
  title: string;
  description?: string;
  actions?: JSX.Element;
}) {
  return (
    <div class="mb-2 flex items-end justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-ink">{props.title}</h2>
        <Show when={props.description}>
          <p class="text-xs text-ink-muted">{props.description}</p>
        </Show>
      </div>
      {props.actions}
    </div>
  );
}

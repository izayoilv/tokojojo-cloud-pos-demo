import { Inbox } from "lucide-solid";
import type { JSX } from "solid-js";
import { Show } from "solid-js";

export function EmptyState(props: {
  title: string;
  description?: string;
  icon?: JSX.Element;
  action?: JSX.Element;
}) {
  return (
    <div class="flex flex-col items-center justify-center gap-2 px-5 py-11 text-center">
      <div class="text-faint opacity-60">
        {props.icon ?? <Inbox size={36} stroke-width={1.6} />}
      </div>
      <p class="text-[13px] font-semibold text-muted">{props.title}</p>
      <Show when={props.description}>
        <p class="max-w-md text-xs text-faint">{props.description}</p>
      </Show>
      <Show when={props.action}>
        <div class="mt-2">{props.action}</div>
      </Show>
    </div>
  );
}

import { For } from "solid-js";

export function Tabs<T extends string>(props: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string }>;
  class?: string;
}) {
  return (
    <div
      role="tablist"
      class={`inline-flex flex-wrap gap-0.5 rounded-[9px] border border-line bg-canvas p-[3px] ${props.class ?? ""}`}
    >
      <For each={props.items}>
        {(item) => (
          <button
            type="button"
            role="tab"
            aria-selected={props.value === item.value}
            onClick={() => props.onChange(item.value)}
            class={`cursor-pointer rounded-[7px] px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors ${
              props.value === item.value
                ? "bg-white font-bold text-navy shadow-sm"
                : "font-semibold text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  );
}

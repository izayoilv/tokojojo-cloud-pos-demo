import { For } from "solid-js";

export function Tabs<T extends string>(props: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string; count?: number }>;
  label?: string;
  class?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={props.label}
      class={`flex flex-wrap gap-1 border-b border-line ${props.class ?? ""}`}
    >
      <For each={props.items}>
        {(item) => {
          const active = () => props.value === item.value;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active()}
              onClick={() => props.onChange(item.value)}
              class={`relative -mb-px flex h-10 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm transition-colors ${
                active()
                  ? "border-primary font-bold text-primary"
                  : "border-transparent font-semibold text-ink-muted hover:text-ink"
              }`}
            >
              {item.label}
              {item.count !== undefined ? (
                <span
                  class={`rounded-full px-1.5 py-px text-[11px] font-bold ${
                    active()
                      ? "bg-primary-soft text-primary"
                      : "bg-subtle text-ink-muted"
                  }`}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        }}
      </For>
    </div>
  );
}

export function SegmentedControl<T extends string>(props: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string }>;
  label?: string;
  class?: string;
}) {
  return (
    <div
      role="group"
      aria-label={props.label}
      class={`inline-flex flex-wrap gap-0.5 rounded-[6px] border border-line bg-subtle p-0.5 ${props.class ?? ""}`}
    >
      <For each={props.items}>
        {(item) => {
          const active = () => props.value === item.value;
          return (
            <button
              type="button"
              aria-pressed={active()}
              onClick={() => props.onChange(item.value)}
              class={`h-8 cursor-pointer rounded-[4px] px-3 text-xs whitespace-nowrap transition-colors ${
                active()
                  ? "bg-surface font-bold text-ink shadow-dropdown"
                  : "font-semibold text-ink-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        }}
      </For>
    </div>
  );
}

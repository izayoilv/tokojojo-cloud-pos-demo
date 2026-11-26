import type { JSX } from "solid-js";

export function Switch(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label class="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        class="peer sr-only"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      <span
        aria-hidden="true"
        class="relative h-6 w-11 rounded-full bg-subtle transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-surface after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
      />
      <span class="sr-only">{props.label}</span>
    </label>
  );
}

export function Checkbox(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  return (
    <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
        class="size-4 rounded-[3px] border-line-control accent-primary disabled:opacity-50"
      />
      {props.showLabel === false ? (
        <span class="sr-only">{props.label}</span>
      ) : (
        props.label
      )}
    </label>
  );
}

export function Toolbar(props: { children: JSX.Element; class?: string }) {
  return (
    <div class={`flex flex-wrap items-end gap-3 ${props.class ?? ""}`}>
      {props.children}
    </div>
  );
}

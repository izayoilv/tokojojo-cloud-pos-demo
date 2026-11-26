import type { JSX } from "solid-js";
import {
  createContext,
  createUniqueId,
  Show,
  splitProps,
  useContext,
} from "solid-js";

const FieldIdContext = createContext<string>();

export const inputClass =
  "h-10 w-full rounded-[6px] border border-line-control bg-surface px-3 text-sm text-ink placeholder:text-ink-muted outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-disabled";

export const selectClass = `${inputClass} cursor-pointer appearance-none bg-[linear-gradient(45deg,transparent_50%,var(--tj-ink-muted)_50%),linear-gradient(135deg,var(--tj-ink-muted)_50%,transparent_50%)] bg-[position:calc(100%-14px)_50%,calc(100%-9px)_50%] bg-[size:5px_5px,5px_5px] bg-no-repeat pr-8`;

export const textareaClass =
  "min-h-20 w-full resize-y rounded-[6px] border border-line-control bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-disabled";

export function Field(props: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  class?: string;
  children: JSX.Element;
}) {
  const generatedId = createUniqueId();
  const id = props.htmlFor ?? generatedId;

  return (
    <FieldIdContext.Provider value={id}>
      <div class={`flex flex-col gap-1.5 ${props.class ?? ""}`}>
        <label for={id} class="text-xs font-semibold text-ink-secondary">
          {props.label}
          <Show when={props.required}>
            <span class="text-danger"> *</span>
          </Show>
        </label>
        {props.children}
        <Show when={props.hint}>
          <p class="text-xs text-ink-muted">{props.hint}</p>
        </Show>
        <Show when={props.error}>
          <p class="text-xs font-semibold text-danger">{props.error}</p>
        </Show>
      </div>
    </FieldIdContext.Provider>
  );
}

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, rest] = splitProps(props, ["class", "id"]);
  const fieldId = useContext(FieldIdContext);
  return (
    <input
      id={local.id ?? fieldId}
      {...rest}
      class={`${inputClass} ${local.class ?? ""}`}
    />
  );
}

export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
  const [local, rest] = splitProps(props, ["class", "id"]);
  const fieldId = useContext(FieldIdContext);
  return (
    <select
      id={local.id ?? fieldId}
      {...rest}
      class={`${selectClass} ${local.class ?? ""}`}
    />
  );
}

export function Textarea(
  props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const [local, rest] = splitProps(props, ["class", "id"]);
  const fieldId = useContext(FieldIdContext);
  return (
    <textarea
      id={local.id ?? fieldId}
      {...rest}
      class={`${textareaClass} ${local.class ?? ""}`}
    />
  );
}

export function SearchInput(
  props: Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    class?: string;
  },
) {
  const [local, rest] = splitProps(props, ["class", "id", "aria-label"]);
  const fieldId = useContext(FieldIdContext);
  const ariaLabel = local["aria-label"] ?? rest.placeholder ?? "Cari";
  return (
    <div class={`relative ${local.class ?? ""}`}>
      <svg
        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        id={local.id ?? fieldId}
        {...rest}
        type="search"
        aria-label={ariaLabel}
        class={`${inputClass} pl-9`}
      />
    </div>
  );
}

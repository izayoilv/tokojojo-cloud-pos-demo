import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

type Variant =
  "primary" | "secondary" | "ghost" | "success" | "danger" | "soft-danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "border border-line-control bg-surface text-ink hover:bg-hover active:bg-subtle",
  ghost: "text-ink-secondary hover:bg-subtle hover:text-ink",
  success: "bg-success text-white hover:opacity-90",
  danger: "bg-danger text-white hover:opacity-90",
  "soft-danger":
    "border border-danger/30 bg-danger-soft text-danger hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-sm",
};

export function Button(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    full?: boolean;
    loading?: boolean;
  },
) {
  const [local, rest] = splitProps(props, [
    "variant",
    "size",
    "full",
    "loading",
    "class",
    "children",
    "disabled",
  ]);

  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      disabled={local.disabled || local.loading}
      class={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[6px] font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 ${variants[local.variant ?? "secondary"]} ${sizes[local.size ?? "md"]} ${local.full ? "w-full" : ""} ${local.class ?? ""}`}
    >
      {local.loading ? (
        <span class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {local.children}
    </button>
  );
}

export function IconButton(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    variant?: "secondary" | "ghost";
  },
) {
  const [local, rest] = splitProps(props, [
    "label",
    "variant",
    "class",
    "children",
  ]);

  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      aria-label={local.label}
      title={local.label}
      class={`inline-flex size-9 cursor-pointer items-center justify-center rounded-[6px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 ${
        local.variant === "ghost"
          ? "text-ink-muted hover:bg-subtle hover:text-ink"
          : "border border-line-control bg-surface text-ink-secondary hover:bg-hover"
      } ${local.class ?? ""}`}
    >
      {local.children}
    </button>
  );
}

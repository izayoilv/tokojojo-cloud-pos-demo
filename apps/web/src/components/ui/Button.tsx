import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

type Variant = "primary" | "secondary" | "success" | "danger" | "ghost";
type Size = "md" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-royal text-white hover:bg-blue-800",
  secondary:
    "border border-line bg-white text-muted hover:bg-canvas hover:text-ink",
  success: "bg-success text-white hover:bg-green-700",
  danger: "border border-red-200 bg-red-50 text-danger hover:bg-red-100",
  ghost: "text-muted hover:bg-canvas hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-[18px] text-[13px]",
  sm: "h-[30px] px-[11px] text-xs",
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
      disabled={local.disabled || local.loading}
      class={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[9px] font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[local.variant ?? "secondary"]} ${sizes[local.size ?? "md"]} ${local.full ? "w-full" : ""} ${local.class ?? ""}`}
    >
      {local.loading ? (
        <span class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {local.children}
    </button>
  );
}

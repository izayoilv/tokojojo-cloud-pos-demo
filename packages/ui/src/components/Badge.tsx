import type { JSX } from "solid-js";

export type BadgeTone =
  "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "violet";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-subtle text-ink-secondary",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  violet: "bg-violet-soft text-violet",
};

export function Badge(props: {
  tone?: BadgeTone;
  children: JSX.Element;
  class?: string;
}) {
  return (
    <span
      class={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-bold whitespace-nowrap ${tones[props.tone ?? "neutral"]} ${props.class ?? ""}`}
    >
      {props.children}
    </span>
  );
}

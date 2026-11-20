import type { JSX } from "solid-js";

export type PillTone = "green" | "blue" | "amber" | "red" | "gray" | "purple";

const tones: Record<PillTone, string> = {
  green: "bg-emerald-50 text-green-700",
  blue: "bg-blue-50 text-royal",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-danger",
  gray: "bg-slate-100 text-muted",
  purple: "bg-violet-50 text-violet-700",
};

export function Pill(props: {
  tone?: PillTone;
  children: JSX.Element;
  class?: string;
}) {
  return (
    <span
      class={`inline-block rounded-full px-[9px] py-[3px] text-[10.5px] font-bold whitespace-nowrap ${tones[props.tone ?? "gray"]} ${props.class ?? ""}`}
    >
      {props.children}
    </span>
  );
}

export function RoleChip(props: { role: string; color: string }) {
  return (
    <span
      class="inline-block rounded-full px-[9px] py-[3px] text-[10px] font-extrabold"
      style={{ background: `${props.color}18`, color: props.color }}
    >
      {props.role}
    </span>
  );
}

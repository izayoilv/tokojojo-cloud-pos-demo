import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

export function TableWrap(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div {...rest} class={`w-full overflow-x-auto ${local.class ?? ""}`}>
      {local.children}
    </div>
  );
}

export function Table(props: JSX.IntrinsicElements["table"]) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <table
      {...rest}
      class={`w-full min-w-[720px] border-collapse text-sm ${local.class ?? ""}`}
    >
      {local.children}
    </table>
  );
}

export function Th(
  props: JSX.IntrinsicElements["th"] & {
    align?: "left" | "right" | "center";
  },
) {
  const [local, rest] = splitProps(props, ["class", "children", "align"]);
  return (
    <th
      {...rest}
      class={`h-10 border-b border-line bg-subtle px-3 text-xs font-bold tracking-[0.06em] whitespace-nowrap text-ink-muted uppercase ${
        local.align === "right"
          ? "text-right"
          : local.align === "center"
            ? "text-center"
            : "text-left"
      } ${local.class ?? ""}`}
    >
      {local.children}
    </th>
  );
}

export function Td(
  props: JSX.IntrinsicElements["td"] & {
    align?: "left" | "right" | "center";
  },
) {
  const [local, rest] = splitProps(props, ["class", "children", "align"]);
  return (
    <td
      {...rest}
      class={`min-h-11 border-b border-line px-3 py-2.5 align-middle ${
        local.align === "right"
          ? "text-right tabular-nums whitespace-nowrap"
          : local.align === "center"
            ? "text-center"
            : "text-left"
      } ${local.class ?? ""}`}
    >
      {local.children}
    </td>
  );
}

export function Pagination(props: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = () => Math.max(1, Math.ceil(props.total / props.pageSize));
  const start = () =>
    props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const end = () => Math.min(props.page * props.pageSize, props.total);

  return (
    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-ink-muted">
      <span>
        Menampilkan {start()}–{end()} dari {props.total}
      </span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          disabled={props.page <= 1}
          onClick={() => props.onPage(props.page - 1)}
          class="h-8 cursor-pointer rounded-[6px] border border-line-control bg-surface px-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sebelumnya
        </button>
        <span class="px-1 font-semibold text-ink">
          {props.page} / {pages()}
        </span>
        <button
          type="button"
          disabled={props.page >= pages()}
          onClick={() => props.onPage(props.page + 1)}
          class="h-8 cursor-pointer rounded-[6px] border border-line-control bg-surface px-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}

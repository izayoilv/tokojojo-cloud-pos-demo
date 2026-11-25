import { AlertTriangle, Inbox, RefreshCw } from "lucide-solid";
import type { JSX } from "solid-js";
import { Show } from "solid-js";

import { Button } from "./Button";

export function EmptyState(props: {
  title: string;
  description?: string;
  icon?: JSX.Element;
  action?: JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${props.class ?? ""}`}
    >
      <span class="text-ink-muted opacity-70">
        {props.icon ?? <Inbox size={40} stroke-width={1.6} />}
      </span>
      <div>
        <p class="text-base font-bold text-ink">{props.title}</p>
        <Show when={props.description}>
          <p class="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            {props.description}
          </p>
        </Show>
      </div>
      <Show when={props.action}>
        <div class="mt-1">{props.action}</div>
      </Show>
    </div>
  );
}

export function ErrorState(props: {
  message?: string;
  onRetry?: () => void;
  class?: string;
}) {
  return (
    <div
      class={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${props.class ?? ""}`}
    >
      <span class="flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle size={22} />
      </span>
      <div>
        <p class="text-base font-bold text-ink">Gagal memuat data</p>
        <p class="mx-auto mt-1 max-w-md text-sm text-ink-muted">
          {props.message ?? "Terjadi kesalahan saat mengambil data."}
        </p>
      </div>
      <Show when={props.onRetry}>
        <Button size="sm" onClick={props.onRetry}>
          <RefreshCw size={14} /> Coba lagi
        </Button>
      </Show>
    </div>
  );
}

export function Skeleton(props: { class?: string }) {
  return (
    <div class={`animate-pulse rounded-[4px] bg-subtle ${props.class ?? ""}`} />
  );
}

export function TableSkeleton(props: { rows?: number; cols?: number }) {
  return (
    <div class="divide-y divide-line">
      {Array.from({ length: props.rows ?? 6 }).map(() => (
        <div class="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: props.cols ?? 5 }).map((_, index) => (
            <Skeleton class={`h-3.5 ${index === 0 ? "w-40" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div class="space-y-4">
      <Skeleton class="h-20 w-full" />
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map(() => (
          <Skeleton class="h-28 w-full" />
        ))}
      </div>
      <Skeleton class="h-72 w-full" />
    </div>
  );
}

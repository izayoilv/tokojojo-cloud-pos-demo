export function Skeleton(props: { class?: string }) {
  return (
    <div
      class={`animate-pulse rounded-md bg-slate-200/80 ${props.class ?? ""}`}
    />
  );
}

export function TableSkeleton(props: { rows?: number; cols?: number }) {
  return (
    <div class="divide-y divide-slate-100">
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

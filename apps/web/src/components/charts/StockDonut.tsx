import { For, Show } from "solid-js";

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function StockDonut(props: { slices: DonutSlice[] }) {
  const total = () => props.slices.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;
  const segments = () =>
    props.slices.map((slice) => {
      const length =
        total() === 0 ? 0 : (slice.value / total()) * CIRCUMFERENCE;
      const segment = { ...slice, length, offset };
      offset += length;
      return segment;
    });

  return (
    <div class="flex flex-wrap items-center gap-5">
      <svg
        viewBox="0 0 140 140"
        class="size-[140px] shrink-0 -rotate-90"
        role="img"
        aria-label="Komposisi status stok"
      >
        <circle
          cx="70"
          cy="70"
          r={RADIUS}
          fill="none"
          stroke="var(--tj-subtle)"
          stroke-width="16"
        />
        <For each={segments()}>
          {(slice) => (
            <Show when={slice.length > 0}>
              <circle
                cx="70"
                cy="70"
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                stroke-width="16"
                stroke-dasharray={`${slice.length} ${CIRCUMFERENCE - slice.length}`}
                stroke-dashoffset={-slice.offset}
              >
                <title>{`${slice.label}: ${slice.value} SKU`}</title>
              </circle>
            </Show>
          )}
        </For>
        <g class="rotate-90 origin-center">
          <text
            x="70"
            y="68"
            text-anchor="middle"
            font-size="24"
            font-weight="800"
            fill="var(--tj-ink)"
          >
            {total()}
          </text>
          <text
            x="70"
            y="84"
            text-anchor="middle"
            font-size="11"
            font-weight="700"
            fill="var(--tj-ink-muted)"
          >
            SKU
          </text>
        </g>
      </svg>
      <ul class="flex min-w-[130px] flex-1 list-none flex-col gap-2 p-0 text-sm text-ink-secondary">
        <For each={props.slices}>
          {(slice) => (
            <li class="flex items-center gap-2">
              <span
                class="size-2.5 rounded-full"
                style={{ background: slice.color }}
              />
              {slice.label}
              <strong class="ml-auto tabular-nums text-ink">
                {total() === 0
                  ? "0%"
                  : `${Math.round((slice.value / total()) * 100)}%`}
              </strong>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

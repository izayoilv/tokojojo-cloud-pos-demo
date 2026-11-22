import { For, Show } from "solid-js";

import type { StockValuationSlice } from "../../lib/calc";
import { formatRupiah } from "../../lib/format";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function compact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)} M`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} Jt`;
  }

  return formatRupiah(value);
}

export function StockDonut(props: { slices: StockValuationSlice[] }) {
  const total = () => props.slices.reduce((sum, slice) => sum + slice.value, 0);

  let offset = 0;
  const segments = () =>
    props.slices.map((slice) => {
      const length =
        total() === 0 ? 0 : (slice.value / total()) * CIRCUMFERENCE;
      const segment = {
        ...slice,
        length,
        offset,
      };
      offset += length;
      return segment;
    });

  return (
    <div class="flex flex-wrap items-center gap-[18px]">
      <svg
        viewBox="0 0 140 140"
        class="w-[150px] shrink-0"
        role="img"
        aria-label="Valuasi stok per lokasi"
      >
        <circle
          cx="70"
          cy="70"
          r={RADIUS}
          fill="none"
          stroke="#EEF2F7"
          stroke-width="22"
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
                stroke-width="22"
                stroke-dasharray={`${slice.length} ${CIRCUMFERENCE - slice.length}`}
                stroke-dashoffset={-slice.offset}
                transform="rotate(-90 70 70)"
              >
                <title>{`${slice.label}: ${formatRupiah(slice.value)}`}</title>
              </circle>
            </Show>
          )}
        </For>
        <text x="70" y="66" text-anchor="middle" font-size="10" fill="#64748B">
          Total
        </text>
        <text
          x="70"
          y="81"
          text-anchor="middle"
          font-size="11.5"
          font-weight="800"
          fill="#0F172A"
        >
          {compact(total())}
        </text>
      </svg>

      <div class="flex min-w-[150px] flex-1 flex-col gap-2">
        <For each={props.slices}>
          {(slice) => (
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="flex items-center gap-2 font-semibold text-muted">
                <i
                  class="inline-block size-[11px] rounded-[3px]"
                  style={{ background: slice.color }}
                />
                {slice.location}
              </span>
              <b class="text-ink">{formatRupiah(slice.value)}</b>
            </div>
          )}
        </For>
        <div class="mt-1 border-t border-slate-100 pt-2 text-[11px] text-faint">
          {props.slices[0]?.label} &middot; {props.slices[1]?.label}
        </div>
      </div>
    </div>
  );
}

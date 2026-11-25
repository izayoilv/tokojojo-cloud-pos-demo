import { EmptyState } from "@tokojojo/ui";
import { For, Show } from "solid-js";

import type { DailySalesPoint } from "../../lib/calc";
import { formatRupiah } from "../../lib/format";

const W = 640;
const H = 240;
const LEFT = 64;
const RIGHT = 12;
const TOP = 20;
const BASE = 210;

export function SalesChart(props: { points: DailySalesPoint[] }) {
  const maxValue = () =>
    Math.max(1, ...props.points.map((point) => point.revenue));
  const step = () => (W - LEFT - RIGHT) / Math.max(1, props.points.length - 1);
  const x = (index: number) => LEFT + index * step();
  const y = (value: number) =>
    BASE - (Math.max(0, value) / maxValue()) * (BASE - TOP);

  const axisLabel = (value: number) => {
    if (value >= 1_000_000_000)
      return `${(value / 1_000_000_000).toFixed(1)} M`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} jt`;
    if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
    return "0";
  };

  const linePoints = () =>
    props.points
      .map((point, index) => `${x(index)},${y(point.revenue)}`)
      .join(" ");
  const areaPath = () => {
    if (props.points.length === 0) return "";
    return `M${x(0)} ${BASE} L${props.points
      .map((point, index) => `${x(index)} ${y(point.revenue)}`)
      .join(" L")} L${x(props.points.length - 1)} ${BASE} Z`;
  };

  return (
    <Show
      when={props.points.length > 0}
      fallback={
        <EmptyState
          title="Belum ada penjualan pada periode ini"
          description="Pilih rentang lain atau tunggu transaksi POS tersinkron."
        />
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        class="h-auto w-full"
        role="img"
        aria-label="Tren penjualan"
      >
        <For each={[0, 0.25, 0.5, 0.75, 1]}>
          {(ratio) => (
            <g>
              <line
                x1={LEFT}
                x2={W - RIGHT}
                y1={TOP + ratio * (BASE - TOP)}
                y2={TOP + ratio * (BASE - TOP)}
                stroke="var(--tj-line)"
                stroke-width="1"
              />
              <text
                x={LEFT - 8}
                y={TOP + ratio * (BASE - TOP) + 4}
                text-anchor="end"
                font-size="10"
                fill="var(--tj-ink-muted)"
              >
                {axisLabel(Math.round(maxValue() * (1 - ratio)))}
              </text>
            </g>
          )}
        </For>
        <path d={areaPath()} fill="var(--tj-primary-soft)" opacity="0.8" />
        <polyline
          points={linePoints()}
          fill="none"
          stroke="var(--tj-chart-1)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <For each={props.points}>
          {(point, index) => (
            <g>
              <circle
                cx={x(index())}
                cy={y(point.revenue)}
                r="3.5"
                fill="var(--tj-surface)"
                stroke="var(--tj-chart-1)"
                stroke-width="2"
              >
                <title>{`${point.label}: ${formatRupiah(point.revenue)}`}</title>
              </circle>
              <Show
                when={
                  index() % Math.ceil(props.points.length / 6) === 0 ||
                  index() === props.points.length - 1
                }
              >
                <text
                  x={x(index())}
                  y={BASE + 20}
                  text-anchor="middle"
                  font-size="10"
                  fill="var(--tj-ink-muted)"
                >
                  {point.label}
                </text>
              </Show>
            </g>
          )}
        </For>
      </svg>
    </Show>
  );
}

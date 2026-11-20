import { For, Show } from "solid-js";

import type { DailySalesPoint } from "../../lib/calc";
import { formatRupiah } from "../../lib/format";
import { EmptyState } from "../ui/EmptyState";

const W = 640;
const H = 240;
const LEFT = 30;
const RIGHT = 14;
const TOP = 18;
const BASE = 200;

export function SalesChart(props: { points: DailySalesPoint[] }) {
  const maxValue = () =>
    Math.max(
      1,
      ...props.points.flatMap((point) => [point.revenue, point.cogs]),
    );

  const groupWidth = () =>
    (W - LEFT - RIGHT) / Math.max(1, props.points.length);

  const barWidth = () => Math.min(18, groupWidth() * 0.3);

  const height = (value: number) =>
    (Math.max(0, value) / maxValue()) * (BASE - TOP);

  const centerX = (index: number) =>
    LEFT + index * groupWidth() + groupWidth() / 2;

  const linePoints = () =>
    props.points
      .map(
        (point, index) =>
          `${centerX(index)},${BASE - height(point.grossProfit)}`,
      )
      .join(" ");

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
        class="w-full"
        role="img"
        aria-label="Grafik penjualan, HPP, dan laba kotor"
      >
        <For each={[0, 0.25, 0.5, 0.75, 1]}>
          {(ratio) => (
            <line
              x1={LEFT}
              x2={W - RIGHT}
              y1={BASE - ratio * (BASE - TOP)}
              y2={BASE - ratio * (BASE - TOP)}
              stroke="#EEF2F7"
              stroke-width="1"
            />
          )}
        </For>

        <For each={props.points}>
          {(point, index) => {
            const revenueHeight = () => height(point.revenue);
            const cogsHeight = () => height(point.cogs);
            const x = () => centerX(index());
            const labelStep = () => Math.ceil(props.points.length / 7);

            return (
              <g>
                <rect
                  x={x() - barWidth() - 1.5}
                  y={BASE - revenueHeight()}
                  width={barWidth()}
                  height={revenueHeight()}
                  rx="3"
                  fill="#2563EB"
                >
                  <title>{`Penjualan ${point.label}: ${formatRupiah(point.revenue)}`}</title>
                </rect>
                <rect
                  x={x() + 1.5}
                  y={BASE - cogsHeight()}
                  width={barWidth()}
                  height={cogsHeight()}
                  rx="3"
                  fill="#CBD5E1"
                >
                  <title>{`HPP ${point.label}: ${formatRupiah(point.cogs)}`}</title>
                </rect>
                <Show
                  when={
                    index() % labelStep() === 0 ||
                    index() === props.points.length - 1
                  }
                >
                  <text
                    x={x()}
                    y={BASE + 20}
                    font-size="9.5"
                    fill="#64748B"
                    text-anchor="middle"
                  >
                    {point.label}
                  </text>
                </Show>
              </g>
            );
          }}
        </For>

        <polyline
          points={linePoints()}
          fill="none"
          stroke="#16A34A"
          stroke-width="2.5"
          stroke-linejoin="round"
        />
        <For each={props.points}>
          {(point, index) => (
            <circle
              cx={centerX(index())}
              cy={BASE - height(point.grossProfit)}
              r="3.5"
              fill="#16A34A"
            >
              <title>{`Laba kotor ${point.label}: ${formatRupiah(point.grossProfit)}`}</title>
            </circle>
          )}
        </For>
      </svg>
    </Show>
  );
}

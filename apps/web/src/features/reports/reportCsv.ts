import { formatDateTime } from "../../lib/format";

export type ReportMeta = {
  storeName: string;
  userName: string;
  generatedAt: Date;
};

function escapeCell(value: string | number): string {
  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildReportCsv(
  title: string,
  meta: ReportMeta,
  rows: Array<Array<string | number>>,
): string {
  const header = [
    ["Laporan", title],
    ["Toko", meta.storeName],
    ["Dicetak oleh", meta.userName],
    ["Tanggal", formatDateTime(meta.generatedAt.toISOString())],
  ];

  return [...header, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}

export function buildPrintHtml(props: {
  title: string;
  storeName: string;
  userName: string;
  generatedAt: Date;
  bodyHtml: string;
}): string {
  return `<div style="max-width:700px;margin:0 auto;font-family:Inter,system-ui,sans-serif;color:#0f172a">
  <h2 style="font-size:17px;margin:0 0 4px">${escapeHtml(props.storeName)} &mdash; ${escapeHtml(props.title)}</h2>
  <p style="color:#64748B;font-size:12px;margin:0">Dicetak ${escapeHtml(
    formatDateTime(props.generatedAt.toISOString()),
  )} oleh ${escapeHtml(props.userName)}</p>
  <hr style="margin:12px 0;border:none;border-top:1px solid #e2e8f0" />
  ${props.bodyHtml}
</div>`;
}

export function printReport(html: string): void {
  const area = document.getElementById("print-area");

  if (!area) {
    return;
  }

  area.innerHTML = html;
  window.print();
}

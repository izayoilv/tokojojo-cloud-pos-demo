import type { Sale } from "../../data/types";
import { saleTotals } from "../../lib/calc";
import { formatDateTime, formatRupiah } from "../../lib/format";
import { escapeHtml } from "../reports/reportCsv";

export function buildReceiptHtml(sale: Sale, storeName: string): string {
  const totals = saleTotals(sale);
  const items = sale.items
    .map((item) => {
      const sold = Math.max(0, item.quantity - item.returned);
      const lineTotal = sold * (item.price - item.discount);

      return `<tr>
        <td style="padding:4px 0">${escapeHtml(item.name)}<br><small>${sold} × ${escapeHtml(item.unit)}</small></td>
        <td style="padding:4px 0;text-align:right">${formatRupiah(lineTotal)}</td>
      </tr>`;
    })
    .join("");
  const discountRow =
    totals.discount > 0
      ? `<p style="margin:4px 0 0;display:flex;justify-content:space-between;font-size:12px">
          <span>Diskon</span><span>-${formatRupiah(totals.discount)}</span>
        </p>`
      : "";
  const voidStamp =
    sale.status === "VOIDED"
      ? `<p style="margin:0 0 6px;text-align:center;font-size:14px;font-weight:700;letter-spacing:0.08em">VOID</p>`
      : "";

  return `<div style="max-width:360px;margin:0 auto;font-family:'IBM Plex Mono',monospace;color:#111">
    <h2 style="margin:0 0 4px;font-size:16px">${escapeHtml(storeName)}</h2>
    ${voidStamp}
    <p style="margin:0;font-size:11px">${escapeHtml(sale.number)} · ${escapeHtml(formatDateTime(sale.time))}</p>
    <p style="margin:0 0 8px;font-size:11px">Kasir: ${escapeHtml(sale.cashier)} · ${escapeHtml(sale.terminal)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px">${items}</table>
    <hr style="border:none;border-top:1px dashed #999;margin:8px 0">
    ${discountRow}
    <p style="margin:0;display:flex;justify-content:space-between;font-size:12px">
      <span>Total</span><b>${
        sale.status === "VOIDED"
          ? "DIBATALKAN"
          : formatRupiah(totals.grandTotal)
      }</b>
    </p>
    <p style="margin:4px 0 0;display:flex;justify-content:space-between;font-size:12px">
      <span>Metode</span><span>${escapeHtml(sale.method)}</span>
    </p>
    <p style="margin:12px 0 0;text-align:center;font-size:11px">Terima kasih</p>
  </div>`;
}

export function printReceipt(html: string): void {
  const area = document.getElementById("print-area");

  if (!area) return;

  area.innerHTML = html;
  window.print();
}

export function escapeCsvCell(value: string | number): string {
  const raw = String(value);
  const text =
    typeof value === "string" && /^[=+\-@]/.test(raw) ? `'${raw}` : raw;

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

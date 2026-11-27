const TIME_ZONE = "Asia/Jakarta";

const asDate = (value: Date | string): Date =>
  typeof value === "string" ? new Date(value) : value;

export function formatTime(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).format(asDate(value));
}

export function formatClock(value: Date = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).format(value);
}

export function formatDate(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(asDate(value));
}

export function formatDateTime(value: Date | string): string {
  return `${formatDate(value)} · ${formatTime(value)} WIB`;
}

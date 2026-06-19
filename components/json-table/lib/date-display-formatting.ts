import { parseDateTime } from "@/components/json-table/lib/date-parsing";

export function dateStringToFormat(value: string, format: string): string {
  const date = parseDateTime(value);
  if (!date) return "";

  const pad = (n?: number) =>
    n !== undefined ? String(n).padStart(2, "0") : "00";
  const yyyy =
    date.year !== undefined ? String(date.year).padStart(4, "0") : "0000";
  const mm = pad((date.month ?? 0) + 1);
  const dd = pad(date.day ?? 1);
  const HH = pad(date.hours ?? 0);
  const MM = pad(date.minutes ?? 0);
  const SS = pad(date.seconds ?? 0);

  if (format.includes("T")) return `${yyyy}-${mm}-${dd}T${HH}:${MM}`;
  if (format.includes("-")) return `${yyyy}-${mm}-${dd}`;
  if (format.includes(":")) {
    return date.seconds !== undefined ? `${HH}:${MM}:${SS}` : `${HH}:${MM}`;
  }
  return `${yyyy}-${mm}-${dd}`;
}

export function dateToHTMLDateTimeString(date: string): string {
  return dateStringToFormat(date, "2000-01-01T00:00") || "2000-01-01T00:00";
}

export function dateToHTMLDateString(date: string): string {
  return dateStringToFormat(date, "2000-01-01") || "2000-01-01";
}

export function dateToHTMLTimeString(date: string): string {
  return dateStringToFormat(date, "00:00") || "00:00";
}

export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalDateTimeString(date: Date): string {
  const dateString = getLocalDateString(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${dateString}T${hours}:${minutes}:${seconds}`;
}

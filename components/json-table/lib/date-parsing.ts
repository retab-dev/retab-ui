const dateFormats = [
  { pattern: /(\d{1,2})\s+(\d{1,2})\s+(\d{4})/, day: 1, month: 2, year: 3 },
  { pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, day: 1, month: 2, year: 3 },
  { pattern: /(\d{1,2})-(\d{1,2})-(\d{4})/, day: 1, month: 2, year: 3 },
  { pattern: /(\d{1,2})\.(\d{1,2})\.(\d{4})/, day: 1, month: 2, year: 3 },
  { pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/, year: 1, month: 2, day: 3 },
];

const timeFormat = /(\d{1,2}):(\d{1,2})(:(\d{1,2}))?(\s*(AM|PM))?/i;
const isoDateTimeFormat =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z?$/;
const isoDateTimeShortFormat = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})Z?$/;
const isoDateFormat = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateInfo = {
  year?: number;
  month?: number;
  day?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

export function parseDateTime(value: string): DateInfo | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!input) return null;

  const isoFullMatch = input.match(isoDateTimeFormat);
  if (isoFullMatch) {
    return {
      year: parseInt(isoFullMatch[1], 10),
      month: parseInt(isoFullMatch[2], 10) - 1,
      day: parseInt(isoFullMatch[3], 10),
      hours: parseInt(isoFullMatch[4], 10),
      minutes: parseInt(isoFullMatch[5], 10),
      seconds: parseInt(isoFullMatch[6], 10),
    };
  }

  const isoShortMatch = input.match(isoDateTimeShortFormat);
  if (isoShortMatch) {
    return {
      year: parseInt(isoShortMatch[1], 10),
      month: parseInt(isoShortMatch[2], 10) - 1,
      day: parseInt(isoShortMatch[3], 10),
      hours: parseInt(isoShortMatch[4], 10),
      minutes: parseInt(isoShortMatch[5], 10),
    };
  }

  const isoDateMatch = input.match(isoDateFormat);
  if (isoDateMatch) {
    return {
      year: parseInt(isoDateMatch[1], 10),
      month: parseInt(isoDateMatch[2], 10) - 1,
      day: parseInt(isoDateMatch[3], 10),
    };
  }

  const jsDate = new Date(input);
  if (!Number.isNaN(jsDate.getTime())) {
    return {
      year: jsDate.getFullYear(),
      month: jsDate.getMonth(),
      day: jsDate.getDate(),
      hours: jsDate.getHours(),
      minutes: jsDate.getMinutes(),
      seconds: jsDate.getSeconds(),
    };
  }

  const info: DateInfo = {};
  let remaining = input;
  for (const format of dateFormats) {
    const match = remaining.match(format.pattern);
    if (!match) continue;
    info.year = parseInt(match[format.year], 10);
    info.month = parseInt(match[format.month], 10) - 1;
    info.day = parseInt(match[format.day], 10);
    remaining = remaining.slice(match[0].length).trim();
    break;
  }

  const timeMatch = remaining.match(timeFormat);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = timeMatch[4] ? parseInt(timeMatch[4], 10) : undefined;
    const ampm = timeMatch[6] ? timeMatch[6].toUpperCase() : null;

    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    info.hours = hours;
    info.minutes = minutes;
    if (seconds !== undefined) info.seconds = seconds;
  }

  if (
    info.year === undefined &&
    info.month === undefined &&
    info.day === undefined &&
    info.hours === undefined &&
    info.minutes === undefined &&
    info.seconds === undefined
  ) {
    return null;
  }

  return info;
}

export function parseDateStringAsLocal(
  dateString: string | null | undefined,
): Date | null {
  if (!dateString) return null;
  const info = parseDateTime(dateString);
  if (
    !info ||
    info.year === undefined ||
    info.month === undefined ||
    info.day === undefined
  ) {
    return null;
  }
  const date = new Date(info.year, info.month, info.day);
  return date.getFullYear() === info.year &&
    date.getMonth() === info.month &&
    date.getDate() === info.day
    ? date
    : null;
}

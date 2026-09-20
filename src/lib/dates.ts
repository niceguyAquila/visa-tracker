/** The business runs on Kuala Lumpur time, so "today" is always computed there. */
export const BUSINESS_TIME_ZONE = "Asia/Kuala_Lumpur";

/** YYYY-MM-DD */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const businessDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD for today in Kuala Lumpur. */
export function todayISODate(from = new Date()): string {
  const parts = businessDateFormat.formatToParts(from);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Midnight UTC on today's Kuala Lumpur date, to compare against parseISODate. */
function businessToday(from: Date): Date {
  return parseISODate(todayISODate(from));
}

export function daysUntilISODate(s: string, from = new Date()): number {
  const target = parseISODate(s);
  const today = businessToday(from);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatDisplayDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(parseISODate(iso));
  } catch {
    return iso;
  }
}

export function formatOptionalDisplayDate(
  iso: string | null | undefined,
  empty = "—"
): string {
  if (!iso) return empty;
  return formatDisplayDate(iso);
}

/** True if the ISO date is before today + `months`, date-only. */
export function isBeforeMonths(
  iso: string,
  months: number,
  from = new Date()
): boolean {
  const target = parseISODate(iso);
  const cutoff = businessToday(from);
  cutoff.setUTCMonth(cutoff.getUTCMonth() + months);
  return target.getTime() < cutoff.getTime();
}

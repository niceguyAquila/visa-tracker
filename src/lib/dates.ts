/** YYYY-MM-DD */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function daysUntilISODate(s: string, from = new Date()): number {
  const target = parseISODate(s);
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate()
  );
  const end = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate()
  );
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
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

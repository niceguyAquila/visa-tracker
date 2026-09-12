import { parseISODate } from "./dates";
import type { VisaDays, VisaStatus } from "../types";

export const VISA_DAYS_OPTIONS: VisaDays[] = ["90 Days", "30 Days"];

export const ARCHIVE_STATUSES: VisaStatus[] = [
  "Cuti",
  "Blacklist",
  "Finished",
];

function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Matches DB: 90 Days → +80, 30 Days → +20 from date entered. */
export function computeDateToExtension(
  dateEntered: string,
  visaDays: VisaDays
): string | null {
  if (!dateEntered) return null;
  if (visaDays === "90 Days") return addDaysISO(dateEntered, 80);
  if (visaDays === "30 Days") return addDaysISO(dateEntered, 20);
  return null;
}

/** Matches DB: date_extended + 50, or blank if not extended. */
export function computeLeaveDateReminder(
  dateExtended: string | null | undefined
): string | null {
  if (!dateExtended) return null;
  return addDaysISO(dateExtended, 50);
}

/** Matches DB generated status column. */
export function computeVisaStatus(flags: {
  cycle_done: boolean;
  blacklist: boolean;
  cuti: boolean;
}): VisaStatus {
  if (flags.cycle_done) return "Finished";
  if (flags.blacklist) return "Blacklist";
  if (flags.cuti) return "Cuti";
  return "In-Progress";
}

/** Exclusive flags for a chosen status (for form → DB). */
export function flagsFromVisaStatus(status: VisaStatus): {
  cycle_done: boolean;
  blacklist: boolean;
  cuti: boolean;
} {
  return {
    cycle_done: status === "Finished",
    blacklist: status === "Blacklist",
    cuti: status === "Cuti",
  };
}

export const VISA_STATE_OPTIONS: VisaStatus[] = [
  "In-Progress",
  "Cuti",
  "Blacklist",
  "Finished",
];

export const VISA_ARCHIVE_STATE_OPTIONS: VisaStatus[] = [
  "Cuti",
  "Blacklist",
  "Finished",
];

export function friendlyInProgressConflict(message: string): string {
  if (
    /visas_one_in_progress_per_customer|unique|duplicate/i.test(message)
  ) {
    return "This customer already has an In-Progress visa. Finish or archive it before adding another.";
  }
  return message;
}

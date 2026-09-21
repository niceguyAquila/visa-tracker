import { daysUntilISODate, parseISODate, todayISODate } from "./dates";
import type { VisaDays, VisaStatus } from "../types";

export const VISA_DAYS_OPTIONS: VisaDays[] = ["90 Days", "30 Days"];

export const DEFAULT_ENTRY_PORTS = [
  "Senai",
  "Putri",
  "PG",
  "Tg.P",
  "KLIA 1",
  "KLIA 2",
] as const;

export function mergeEntryPortOptions(
  custom: string[],
  ...currents: string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };
  for (const port of DEFAULT_ENTRY_PORTS) push(port);
  for (const port of custom) push(port);
  for (const port of currents) push(port);
  return out;
}

export function formatVisaRoute(
  route?: string | null,
  exitRoute?: string | null
): string {
  const from = route?.trim() ?? "";
  const to = exitRoute?.trim() ?? "";
  if (from && to) return `${from} → ${to}`;
  if (from) return from;
  if (to) return `→ ${to}`;
  return "—";
}

export function existingEntryPort(
  name: string,
  options: string[]
): string | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return options.find((port) => port.toLowerCase() === key);
}

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

/** Matches DB: 90 Days → +90, 30 Days → +30 from date entered. */
export function computeDateToExtension(
  dateEntered: string | null | undefined,
  visaDays: VisaDays
): string | null {
  if (!dateEntered) return null;
  if (visaDays === "90 Days") return addDaysISO(dateEntered, 90);
  if (visaDays === "30 Days") return addDaysISO(dateEntered, 30);
  return null;
}

/** Matches DB: date_to_extension + 60, or blank until date entered is set. */
export function computeLeaveDateReminder(
  dateToExtension: string | null | undefined
): string | null {
  if (!dateToExtension) return null;
  return addDaysISO(dateToExtension, 60);
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

/** Fill today when first marking Finished; keep an existing value otherwise. */
export function actualLeaveDateForStatus(
  status: VisaStatus,
  current: string
): string {
  if (status === "Finished" && !current) return todayISODate();
  return current;
}

export function actualLeaveDateForSave(actualLeaveDate: string): string | null {
  return actualLeaveDate || null;
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

export function isVisaLanded(
  dateEntered: string | null | undefined
): boolean {
  return Boolean(dateEntered);
}

/** "confirmed" while the recorded leave date is still in the future. */
export type LeavePhase = "none" | "confirmed" | "left";

export function deriveLeavePhase(
  actualLeaveDate: string | null | undefined,
  from = new Date()
): LeavePhase {
  if (!actualLeaveDate) return "none";
  return daysUntilISODate(actualLeaveDate, from) > 0 ? "confirmed" : "left";
}

export function leavePhaseLabel(phase: LeavePhase): string {
  switch (phase) {
    case "left":
      return "Left";
    case "confirmed":
      return "Confirmed to leave";
    case "none":
      return "Not left yet";
  }
}

export function validateLeaveDate(
  input: {
    status: VisaStatus;
    actualLeaveDate: string;
    dateEntered: string;
  },
  from = new Date()
): string | undefined {
  if (input.status === "Finished" && !input.actualLeaveDate) {
    return "Leave date is required when status is Finished.";
  }
  if (
    input.actualLeaveDate &&
    input.dateEntered &&
    input.actualLeaveDate < input.dateEntered
  ) {
    return "Leave date cannot be before date entered.";
  }
  // Past dates are swept to Finished, so In-Progress would not survive the save.
  if (
    input.status === "In-Progress" &&
    deriveLeavePhase(input.actualLeaveDate, from) === "left"
  ) {
    return "Past leave dates finish the visa. Pick a future date, or mark it Finished.";
  }
  return undefined;
}

export type ExtensionTimelineKind =
  | "left_before_deadline"
  | "overdue"
  | "extended"
  | "pending"
  | "none";

export type ExtensionTimeline = {
  kind: ExtensionTimelineKind;
  label: string;
};

/** Presentation status for the visa timeline header and Ext. Due node. */
export function deriveExtensionTimeline(
  input: {
    dateToExtension: string | null | undefined;
    dateExtended: string | null | undefined;
    extensionDone: boolean;
    actualLeaveDate: string | null | undefined;
  },
  from = new Date()
): ExtensionTimeline {
  const due = input.dateToExtension ?? null;
  const actualLeave = input.actualLeaveDate ?? null;
  const extended = input.extensionDone || Boolean(input.dateExtended);
  // A future leave date is only a plan, so it cannot resolve the extension yet.
  const hasLeft = deriveLeavePhase(actualLeave, from) === "left";

  if (hasLeft && actualLeave && due && actualLeave <= due) {
    return {
      kind: "left_before_deadline",
      label: "Left before extension deadline",
    };
  }

  const dueDays = due ? daysUntilISODate(due, from) : null;
  if (dueDays !== null && dueDays < 0 && !hasLeft && !extended) {
    return { kind: "overdue", label: "Extension overdue" };
  }

  if (extended) {
    return { kind: "extended", label: "Extension done" };
  }

  if (!due) {
    return { kind: "none", label: "No extension due" };
  }

  return { kind: "pending", label: "Extension not done" };
}

export function friendlyInProgressConflict(message: string): string {
  if (
    /visas_one_in_progress_per_customer|unique|duplicate/i.test(message)
  ) {
    return "This customer already has an In-Progress visa. Finish or archive it before adding another.";
  }
  return message;
}

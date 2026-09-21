import type { LeavePhase } from "./visa";
import type { CustomerStatus, VisaStatus } from "../types";

export function urgencyClass(days: number): string {
  if (days < 0) return "bg-urgent-soft text-urgent-ink";
  if (days <= 10) return "bg-warn-soft text-warn-ink";
  if (days <= 30) return "bg-watch-soft text-watch-ink";
  return "bg-ok-soft text-ok-ink";
}

export function urgencyCellClass(days: number): string {
  if (days < 0) return "text-urgent-ink";
  if (days === 0) return "text-watch-ink";
  if (days <= 10) return "text-warn-ink";
  if (days <= 30) return "text-watch-ink";
  return "text-ink-soft";
}

export function customerStatusBadgeClass(status: CustomerStatus): string {
  if (status === "Currently Not Working") return "bg-cuti-soft text-cuti-ink";
  return "bg-brand-soft text-brand-ink";
}

export function customerStatusSegmentActiveClass(status: CustomerStatus): string {
  if (status === "Currently Not Working") {
    return "bg-cuti-soft text-cuti-ink shadow-sm";
  }
  return "bg-surface text-brand-ink shadow-sm";
}

export function statusBadgeClass(status: VisaStatus): string {
  switch (status) {
    case "In-Progress":
      return "bg-brand-soft text-brand-ink";
    case "Cuti":
      return "bg-cuti-soft text-cuti-ink";
    case "Blacklist":
      return "bg-risk-soft text-risk-ink";
    case "Finished":
      return "bg-done-soft text-done-ink";
    default:
      return "bg-ok-soft text-ok-ink";
  }
}

export function statusRowClass(
  status: VisaStatus,
  leaveDays: number | null,
  landed = true
): string {
  if (status === "Cuti") return "bg-cuti-soft/60 hover:bg-cuti-soft";
  if (status === "Blacklist") return "bg-risk-soft/60 hover:bg-risk-soft";
  if (!landed) return "bg-watch-soft/50 hover:bg-watch-soft";
  if (leaveDays === 0) return "bg-watch-soft hover:bg-watch-soft";
  return "bg-surface hover:bg-paper";
}

export function landedBadgeClass(landed: boolean): string {
  return landed
    ? "bg-success-soft text-success-ink"
    : "bg-watch-soft text-watch-ink";
}

export function landedLabel(landed: boolean): string {
  return landed ? "Landed" : "Not landed";
}

export function leavePhaseBadgeClass(phase: LeavePhase): string {
  if (phase === "left") return "bg-done-soft text-done-ink";
  if (phase === "confirmed") return "bg-watch-soft text-watch-ink";
  return "bg-ok-soft text-ok-ink";
}

export function statusSegmentActiveClass(status: VisaStatus): string {
  switch (status) {
    case "Cuti":
      return "bg-cuti-soft text-cuti-ink shadow-sm";
    case "Blacklist":
      return "bg-risk-soft text-risk-ink shadow-sm";
    case "Finished":
      return "bg-done-soft text-done-ink shadow-sm";
    default:
      return "bg-surface text-brand-ink shadow-sm";
  }
}

export function kpiToneClass(tone?: "red" | "amber" | "yellow"): string {
  if (tone === "red") return "border-urgent-soft bg-urgent-soft";
  if (tone === "amber") return "border-warn-soft bg-warn-soft";
  if (tone === "yellow") return "border-watch-soft bg-watch-soft";
  return "border-line bg-surface";
}

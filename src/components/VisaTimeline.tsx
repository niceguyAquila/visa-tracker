import type { SVGProps } from "react";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import { leavePhaseBadgeClass } from "../lib/ui";
import {
  deriveExtensionTimeline,
  deriveLeavePhase,
  leavePhaseLabel,
} from "../lib/visa";
import type { VisaStatus } from "../types";

export type VisaTimelineValue = {
  date_entered: string | null;
  date_to_extension: string | null;
  date_extended: string | null;
  extension_done: boolean;
  leave_date_reminder: string | null;
  actual_leave_date: string | null;
  status: VisaStatus;
};

type NodeAppearance =
  | "done"
  | "missed"
  | "deadline"
  | "urgent"
  | "derived"
  | "moot"
  | "pending";

type TimelineNode = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  appearance: NodeAppearance;
};

function remainingDaysLabel(days: number): string {
  if (days < 0) return `Passed ${Math.abs(days)}d ago`;
  if (days === 0) return "Due today";
  return `${days}d remaining`;
}

function buildNodes(visa: VisaTimelineValue): TimelineNode[] {
  const extension = deriveExtensionTimeline({
    dateToExtension: visa.date_to_extension,
    dateExtended: visa.date_extended,
    extensionDone: visa.extension_done,
    actualLeaveDate: visa.actual_leave_date,
  });
  const leavePhase = deriveLeavePhase(visa.actual_leave_date);
  const left = leavePhase === "left";
  const extended = visa.extension_done || Boolean(visa.date_extended);
  const extDays = visa.date_to_extension
    ? daysUntilISODate(visa.date_to_extension)
    : null;
  const leaveDays = visa.leave_date_reminder
    ? daysUntilISODate(visa.leave_date_reminder)
    : null;

  const entered: TimelineNode = visa.date_entered
    ? {
        id: "entered",
        label: "Entered",
        value: formatDisplayDate(visa.date_entered),
        appearance: "done",
      }
    : {
        id: "entered",
        label: "Entered",
        value: "Not landed",
        appearance: "pending",
      };

  let extDue: TimelineNode;
  if (!visa.date_to_extension) {
    extDue = {
      id: "ext-due",
      label: "Ext. due",
      value: "—",
      appearance: "pending",
    };
  } else if (extension.kind === "overdue") {
    extDue = {
      id: "ext-due",
      label: "Ext. due",
      value: formatDisplayDate(visa.date_to_extension),
      hint: extDays !== null ? remainingDaysLabel(extDays) : undefined,
      appearance: "urgent",
    };
  } else if (left || extended || extension.kind === "left_before_deadline") {
    extDue = {
      id: "ext-due",
      label: "Ext. due",
      value: formatDisplayDate(visa.date_to_extension),
      hint:
        extension.kind === "left_before_deadline"
          ? "No longer applicable"
          : undefined,
      appearance: "moot",
    };
  } else {
    extDue = {
      id: "ext-due",
      label: "Ext. due",
      value: formatDisplayDate(visa.date_to_extension),
      hint: extDays !== null ? remainingDaysLabel(extDays) : undefined,
      appearance: "deadline",
    };
  }

  const extendedNode: TimelineNode = extended
    ? {
        id: "extended",
        label: "Extended",
        value: visa.date_extended
          ? formatDisplayDate(visa.date_extended)
          : "Done",
        appearance: "done",
      }
    : {
        id: "extended",
        label: "Extended",
        value: "Not extended",
        appearance: "missed",
      };

  const showLeaveCountdown =
    visa.status === "In-Progress" && !left && leaveDays !== null;
  const leaveBy: TimelineNode = visa.leave_date_reminder
    ? {
        id: "leave-by",
        label: "Leave by",
        value: formatDisplayDate(visa.leave_date_reminder),
        hint:
          showLeaveCountdown && leaveDays !== null
            ? remainingDaysLabel(leaveDays)
            : "Planned date",
        appearance: "derived",
      }
    : {
        id: "leave-by",
        label: "Leave by",
        value: "—",
        hint: "Planned date",
        appearance: "derived",
      };

  let actualLeave: TimelineNode;
  if (visa.actual_leave_date && leavePhase === "left") {
    actualLeave = {
      id: "actual-leave",
      label: "Actual leave",
      value: formatDisplayDate(visa.actual_leave_date),
      appearance: "done",
    };
  } else if (visa.actual_leave_date) {
    actualLeave = {
      id: "actual-leave",
      label: "Actual leave",
      value: formatDisplayDate(visa.actual_leave_date),
      hint: "Confirmed, not yet left",
      appearance: "deadline",
    };
  } else if (visa.status === "Finished") {
    actualLeave = {
      id: "actual-leave",
      label: "Actual leave",
      value: "Not recorded",
      appearance: "pending",
    };
  } else {
    actualLeave = {
      id: "actual-leave",
      label: "Actual leave",
      value: "Not left yet",
      appearance: "pending",
    };
  }

  return [entered, extDue, extendedNode, leaveBy, actualLeave];
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" {...props}>
      <path d="M5 12.5l4.2 4.2L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" {...props}>
      <path d="M7 7l10 10M17 7L7 17" strokeLinecap="round" />
    </svg>
  );
}

function DashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" {...props}>
      <path d="M6 12h12" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M12 9v4.5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
      <path d="M11.1 4.8L3.4 18.2A1.2 1.2 0 0 0 4.45 20h15.1a1.2 1.2 0 0 0 1.05-1.8L12.9 4.8a1.05 1.05 0 0 0-1.8 0Z" />
    </svg>
  );
}

function appearanceStatus(appearance: NodeAppearance): string {
  switch (appearance) {
    case "done":
      return "Completed";
    case "moot":
      return "Resolved";
    case "missed":
      return "Not done";
    case "urgent":
      return "Overdue";
    case "deadline":
      return "Upcoming deadline";
    case "derived":
      return "Planned date";
    case "pending":
      return "Not yet";
  }
}

function DepartureIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M4 12h13M12.5 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 5v14" strokeLinecap="round" />
    </svg>
  );
}

function LeaveBadge({ visa }: { visa: VisaTimelineValue }) {
  const phase = deriveLeavePhase(visa.actual_leave_date);
  if (phase !== "confirmed") return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${leavePhaseBadgeClass(phase)}`}
    >
      <DepartureIcon className="size-3.5" />
      {leavePhaseLabel(phase)}
    </span>
  );
}

function NodeCircle({ appearance }: { appearance: NodeAppearance }) {
  const iconClass = "size-3.5";
  const circle =
    appearance === "done" ? (
      <span className="flex size-7 items-center justify-center rounded-full bg-success-ink text-white">
        <CheckIcon className={iconClass} />
      </span>
    ) : appearance === "moot" ? (
      <span className="flex size-7 items-center justify-center rounded-full bg-ok-ink text-white">
        <CheckIcon className={iconClass} />
      </span>
    ) : appearance === "missed" ? (
      <span className="flex size-7 items-center justify-center rounded-full border border-line-strong bg-paper text-muted">
        <CloseIcon className={iconClass} />
      </span>
    ) : appearance === "urgent" ? (
      <span className="flex size-7 items-center justify-center rounded-full border-2 border-warn-ink bg-warn-soft text-warn-ink">
        <AlertIcon className={iconClass} />
      </span>
    ) : appearance === "deadline" ? (
      <span className="flex size-7 items-center justify-center rounded-full border-2 border-line-strong bg-surface text-ink-soft">
        <DashIcon className={iconClass} />
      </span>
    ) : appearance === "derived" ? (
      <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-line-strong bg-paper text-muted">
        <DashIcon className={iconClass} />
      </span>
    ) : (
      <span className="flex size-7 items-center justify-center rounded-full border-2 border-line bg-surface text-muted">
        <DashIcon className={iconClass} />
      </span>
    );

  return (
    <span className="relative inline-flex">
      {circle}
      <span className="sr-only">{appearanceStatus(appearance)}</span>
    </span>
  );
}

function HeaderBadge({ visa }: { visa: VisaTimelineValue }) {
  const extension = deriveExtensionTimeline({
    dateToExtension: visa.date_to_extension,
    dateExtended: visa.date_extended,
    extensionDone: visa.extension_done,
    actualLeaveDate: visa.actual_leave_date,
  });

  if (extension.kind === "none") return null;

  const tone =
    extension.kind === "overdue"
      ? "bg-warn-soft text-warn-ink"
      : extension.kind === "left_before_deadline" || extension.kind === "extended"
        ? "bg-success-soft text-success-ink"
        : "bg-ok-soft text-ok-ink";

  const Icon =
    extension.kind === "overdue"
      ? AlertIcon
      : extension.kind === "pending"
        ? DashIcon
        : CheckIcon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>
      <Icon className="size-3.5" />
      {extension.label}
    </span>
  );
}

function TimelineItem({
  node,
  isFirst,
  isLast,
}: {
  node: TimelineNode;
  isFirst: boolean;
  isLast: boolean;
}) {
  const valueClass =
    node.appearance === "urgent"
      ? "text-warn-ink"
      : node.appearance === "derived" || node.appearance === "missed" || node.appearance === "pending"
        ? "text-muted"
        : node.appearance === "moot"
          ? "text-ink-soft"
          : "text-ink";

  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-x-3 md:flex md:min-w-0 md:flex-1 md:flex-col md:items-stretch">
      <p className="col-start-2 meta md:order-1 md:mb-2 md:text-center">
        {node.label}
      </p>
      <div className="col-start-1 row-span-3 flex flex-col items-center md:order-2 md:flex-row">
        <div
          aria-hidden="true"
          className={`hidden h-px flex-1 md:block ${isFirst ? "bg-transparent" : "bg-line"}`}
        />
        <NodeCircle appearance={node.appearance} />
        <div
          aria-hidden="true"
          className={`hidden h-px flex-1 md:block ${isLast ? "bg-transparent" : "bg-line"}`}
        />
        <div
          aria-hidden="true"
          className={`w-px flex-1 md:hidden ${isLast ? "hidden" : "bg-line"}`}
        />
      </div>
      <div
        className={`col-start-2 min-w-0 md:order-3 md:pt-2 md:text-center ${
          isLast ? "pb-0" : "pb-5"
        } md:pb-0`}
      >
        <p className={`text-sm font-medium ${valueClass}`}>{node.value}</p>
        {node.hint ? (
          <p
            className={`mt-0.5 text-xs ${
              node.appearance === "urgent" ? "text-warn-ink" : "text-muted"
            }`}
          >
            {node.hint}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function VisaTimeline({ visa }: { visa: VisaTimelineValue }) {
  const nodes = buildNodes(visa);

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">Timeline</h2>
        <LeaveBadge visa={visa} />
        <HeaderBadge visa={visa} />
      </div>
      <ol className="md:flex md:items-start" aria-label="Visa date timeline">
        {nodes.map((node, index) => (
          <TimelineItem
            key={node.id}
            node={node}
            isFirst={index === 0}
            isLast={index === nodes.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

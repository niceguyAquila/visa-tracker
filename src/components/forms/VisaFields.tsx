import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatDisplayDate } from "../../lib/dates";
import {
  computeDateToExtension,
  computeLeaveDateReminder,
  deriveLeavePhase,
  existingEntryPort,
  mergeEntryPortOptions,
  VISA_DAYS_OPTIONS,
} from "../../lib/visa";
import type { VisaDays } from "../../types";
import {
  FieldError,
  FieldLabel,
  inputClass,
  inputErrorClass,
  SwitchField,
} from "./formStyles";

export type VisaFieldsValue = {
  visaDays: VisaDays;
  dateEntered: string;
  dateExtended: string;
  extensionDone: boolean;
  route: string;
  actualLeaveDate: string;
};

export type VisaFieldErrors = Partial<
  Record<"dateEntered" | "visaDays" | "actualLeaveDate", string>
>;

type VisaFieldsProps = {
  value: VisaFieldsValue;
  onChange: (patch: Partial<VisaFieldsValue>) => void;
  required?: boolean;
  errors?: VisaFieldErrors;
  /** Extra content inside the More details panel (e.g. status controls). */
  moreDetailsExtra?: ReactNode;
  defaultMoreOpen?: boolean;
  customPorts?: string[];
  /** Finished visas must record the day the customer left. */
  leaveDateRequired?: boolean;
};

export function VisaFields({
  value,
  onChange,
  required = true,
  errors = {},
  moreDetailsExtra,
  defaultMoreOpen = false,
  customPorts = [],
  leaveDateRequired = false,
}: VisaFieldsProps) {
  const hasAdvanced =
    Boolean(value.dateExtended) ||
    value.extensionDone ||
    Boolean(value.actualLeaveDate) ||
    defaultMoreOpen;
  const [moreOpen, setMoreOpen] = useState(hasAdvanced);

  useEffect(() => {
    if (hasAdvanced) setMoreOpen(true);
  }, [hasAdvanced]);

  const portOptions = mergeEntryPortOptions(customPorts, value.route);
  const selectValue =
    existingEntryPort(value.route, portOptions) ?? value.route;

  const previewDateToExtension = computeDateToExtension(
    value.dateEntered,
    value.visaDays
  );
  const previewLeaveReminder = computeLeaveDateReminder(
    previewDateToExtension
  );

  const leavePhase = deriveLeavePhase(value.actualLeaveDate);
  const leaveDateHint =
    leavePhase === "confirmed"
      ? "Shows as “Confirmed to leave”, then finishes this visa on that day."
      : leavePhase === "left"
        ? "Recorded as the day they left."
        : "The day they leave. A future date shows as “Confirmed to leave”.";

  function onDateExtendedChange(next: string) {
    onChange({
      dateExtended: next,
      ...(next ? { extensionDone: true } : {}),
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <FieldLabel required={required}>Visa days</FieldLabel>
          <select
            required={required}
            value={value.visaDays}
            onChange={(e) => onChange({ visaDays: e.target.value as VisaDays })}
            className={errors.visaDays ? inputErrorClass : inputClass}
          >
            {VISA_DAYS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <FieldError message={errors.visaDays} />
        </label>
        <label className="block">
          <FieldLabel>Date entered</FieldLabel>
          <input
            type="date"
            value={value.dateEntered}
            onChange={(e) => onChange({ dateEntered: e.target.value })}
            className={errors.dateEntered ? inputErrorClass : inputClass}
            aria-invalid={Boolean(errors.dateEntered)}
          />
          <p className="mt-1 text-xs text-muted">
            Optional. Leave blank if the customer has not landed yet.
          </p>
          <FieldError message={errors.dateEntered} />
        </label>
      </div>

      <div>
        <label className="block">
          <FieldLabel>Route</FieldLabel>
          <select
            value={selectValue}
            onChange={(e) => onChange({ route: e.target.value })}
            className={inputClass}
          >
            <option value="">Select…</option>
            {portOptions.map((port) => (
              <option key={port} value={port}>
                {port}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-xs text-muted">
          Need another?{" "}
          <Link to="/settings#ports" className="link-brand">
            Manage ports
          </Link>
        </p>
      </div>

      <div className="rounded-lg border border-line bg-paper px-3 py-3">
        <p className="meta">
          Timeline
        </p>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4">
          <TimelineStep
            label="Entered"
            value={
              value.dateEntered ? formatDisplayDate(value.dateEntered) : "Not landed"
            }
            hint={
              !value.dateEntered
                ? "Fill in when the customer lands"
                : undefined
            }
          />
          <TimelineStep
            label="Extend by"
            value={
              previewDateToExtension
                ? formatDisplayDate(previewDateToExtension)
                : "—"
            }
            hint={
              !value.dateEntered ? "After date entered is set" : undefined
            }
          />
          <TimelineStep
            label="Leave by"
            value={
              previewLeaveReminder
                ? formatDisplayDate(previewLeaveReminder)
                : "—"
            }
            hint={
              !value.dateEntered
                ? "After date entered is set"
                : "Planned leave date"
            }
          />
        </ol>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className="link-brand text-sm"
        >
          {moreOpen ? "Hide more details" : "More details"}
        </button>

        {moreOpen ? (
          <div className="space-y-4 rounded-lg border border-line bg-surface p-3">
            <div>
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <label className="block">
                  <FieldLabel>Date extended</FieldLabel>
                  <input
                    type="date"
                    value={value.dateExtended}
                    onChange={(e) => onDateExtendedChange(e.target.value)}
                    className={inputClass}
                  />
                </label>

                <SwitchField
                  label="Extension done"
                  checked={value.extensionDone}
                  onChange={(next) => onChange({ extensionDone: next })}
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                Setting a date marks extension as done. You can still toggle that
                manually.
              </p>
            </div>

            <label className="block">
              <FieldLabel required={leaveDateRequired}>Leave date</FieldLabel>
              <input
                type="date"
                required={leaveDateRequired}
                value={value.actualLeaveDate}
                min={value.dateEntered || undefined}
                onChange={(e) => onChange({ actualLeaveDate: e.target.value })}
                className={
                  errors.actualLeaveDate ? inputErrorClass : inputClass
                }
                aria-invalid={Boolean(errors.actualLeaveDate)}
              />
              <p className="mt-1 text-xs text-muted">{leaveDateHint}</p>
              <FieldError message={errors.actualLeaveDate} />
            </label>

            {moreDetailsExtra}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TimelineStep({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <li className="min-w-0">
      <p className="meta">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </li>
  );
}

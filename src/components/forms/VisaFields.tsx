import { useEffect, useState, type ReactNode } from "react";
import { formatDisplayDate } from "../../lib/dates";
import {
  computeDateToExtension,
  computeLeaveDateReminder,
  VISA_DAYS_OPTIONS,
} from "../../lib/visa";
import type { VisaDays } from "../../types";
import {
  FieldError,
  FieldLabel,
  inputClass,
  inputErrorClass,
} from "./formStyles";

export type VisaFieldsValue = {
  visaDays: VisaDays;
  dateEntered: string;
  dateExtended: string;
  extensionDone: boolean;
  masukDari: string;
};

export type VisaFieldErrors = Partial<Record<"dateEntered" | "visaDays", string>>;

type VisaFieldsProps = {
  value: VisaFieldsValue;
  onChange: (patch: Partial<VisaFieldsValue>) => void;
  required?: boolean;
  errors?: VisaFieldErrors;
  /** Extra content inside the More details panel (e.g. status controls). */
  moreDetailsExtra?: ReactNode;
  defaultMoreOpen?: boolean;
};

export function VisaFields({
  value,
  onChange,
  required = true,
  errors = {},
  moreDetailsExtra,
  defaultMoreOpen = false,
}: VisaFieldsProps) {
  const hasAdvanced =
    Boolean(value.dateExtended) || value.extensionDone || defaultMoreOpen;
  const [moreOpen, setMoreOpen] = useState(hasAdvanced);

  useEffect(() => {
    if (hasAdvanced) setMoreOpen(true);
  }, [hasAdvanced]);

  const previewDateToExtension = computeDateToExtension(
    value.dateEntered,
    value.visaDays
  );
  const previewLeaveReminder = computeLeaveDateReminder(
    value.dateExtended || null
  );

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
          <FieldLabel required={required}>Date entered</FieldLabel>
          <input
            type="date"
            required={required}
            value={value.dateEntered}
            onChange={(e) => onChange({ dateEntered: e.target.value })}
            className={errors.dateEntered ? inputErrorClass : inputClass}
            aria-invalid={Boolean(errors.dateEntered)}
          />
          <FieldError message={errors.dateEntered} />
        </label>
      </div>

      <label className="block">
        <FieldLabel>Masuk dari</FieldLabel>
        <input
          value={value.masukDari}
          onChange={(e) => onChange({ masukDari: e.target.value })}
          placeholder="Port of entry"
          className={inputClass}
        />
      </label>

      <div className="rounded-lg border border-line bg-paper px-3 py-3">
        <p className="meta">
          Timeline
        </p>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4">
          <TimelineStep
            label="Entered"
            value={
              value.dateEntered ? formatDisplayDate(value.dateEntered) : "—"
            }
          />
          <TimelineStep
            label="Extend by"
            value={
              previewDateToExtension
                ? formatDisplayDate(previewDateToExtension)
                : "—"
            }
          />
          <TimelineStep
            label="Leave by"
            value={
              previewLeaveReminder
                ? formatDisplayDate(previewLeaveReminder)
                : "—"
            }
            hint={!value.dateExtended ? "After extension date is set" : undefined}
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

                <div className="block">
                  <FieldLabel>Extension done</FieldLabel>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={value.extensionDone}
                    onClick={() =>
                      onChange({ extensionDone: !value.extensionDone })
                    }
                    className={`mt-1 flex h-[42px] w-full items-center justify-between rounded-lg border px-3 text-sm font-medium transition ${
                      value.extensionDone
                        ? "border-success-ink/20 bg-success-soft text-success-ink"
                        : "border-line bg-surface text-ink-soft hover:bg-paper"
                    }`}
                  >
                    <span>{value.extensionDone ? "Yes" : "No"}</span>
                    <span
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
                        value.extensionDone ? "bg-brand" : "bg-line-strong"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition ${
                          value.extensionDone ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted">
                Setting a date marks extension as done. You can still toggle that
                manually.
              </p>
            </div>

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

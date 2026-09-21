import { useEffect, useState, type FormEvent } from "react";
import {
  FieldError,
  FieldLabel,
  inputClass,
  inputErrorClass,
  SwitchField,
} from "./forms/formStyles";
import { VisaStatusFields } from "./forms/VisaStatusFields";
import { formatDisplayDate } from "../lib/dates";
import { supabase } from "../lib/supabase";
import {
  actualLeaveDateForSave,
  actualLeaveDateForStatus,
  computeDateToExtension,
  computeLeaveDateReminder,
  deriveLeavePhase,
  flagsFromVisaStatus,
  friendlyInProgressConflict,
  validateLeaveDate,
} from "../lib/visa";
import type { Visa, VisaStatus } from "../types";

export function VisaQuickEdit({
  visa,
  onClose,
  onSaved,
}: {
  visa: Visa;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [status, setStatus] = useState<VisaStatus>(visa.status);
  const [dateEntered, setDateEntered] = useState(visa.date_entered ?? "");
  const [dateExtended, setDateExtended] = useState(visa.date_extended ?? "");
  const [extensionDone, setExtensionDone] = useState(visa.extension_done);
  const [actualLeaveDate, setActualLeaveDate] = useState(
    visa.actual_leave_date ?? ""
  );
  const [leaveDateError, setLeaveDateError] = useState<string | undefined>();
  const [markAsOpen, setMarkAsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const previewDateToExtension = computeDateToExtension(
    dateEntered,
    visa.visa_days
  );
  const previewLeaveReminder = computeLeaveDateReminder(
    previewDateToExtension
  );
  const leavePhase = deriveLeavePhase(actualLeaveDate);
  const leaveDateHint =
    leavePhase === "confirmed"
      ? "Shows as “Confirmed to leave”, then finishes this visa on that day."
      : leavePhase === "left"
        ? "Recorded as the day they left."
        : "The day they leave. A future date shows as “Confirmed to leave”.";

  function onStatusChange(next: VisaStatus) {
    setStatus(next);
    setActualLeaveDate((prev) => actualLeaveDateForStatus(next, prev));
    setLeaveDateError(undefined);
  }

  function onDateExtendedChange(next: string) {
    setDateExtended(next);
    if (next) setExtensionDone(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const invalid = validateLeaveDate({ status, actualLeaveDate, dateEntered });
    setLeaveDateError(invalid);
    if (invalid) return;

    const flags = flagsFromVisaStatus(status);
    setBusy(true);
    const { error: uErr } = await supabase
      .from("visas")
      .update({
        date_entered: dateEntered || null,
        date_extended: dateExtended || null,
        extension_done: extensionDone,
        actual_leave_date: actualLeaveDateForSave(actualLeaveDate),
        cycle_done: flags.cycle_done,
        cuti: flags.cuti,
        blacklist: flags.blacklist,
      })
      .eq("id", visa.id);
    setBusy(false);

    if (uErr) {
      setError(friendlyInProgressConflict(uErr.message));
      return;
    }
    onSaved("Visa updated.");
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visa-quick-edit-title"
      onClick={onClose}
    >
      <div
        className="panel flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line p-4">
          <h2
            id="visa-quick-edit-title"
            className="text-sm font-semibold text-ink"
          >
            Quick edit
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Status and timeline dates. Use Edit for the full visa record.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <VisaStatusFields
              visaState={status}
              onVisaStateChange={onStatusChange}
              isEdit
              markAsOpen={markAsOpen}
              onMarkAsOpenChange={setMarkAsOpen}
            />

            <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
              <label className="block">
                <FieldLabel>Date entered</FieldLabel>
                <input
                  type="date"
                  value={dateEntered}
                  onChange={(e) => {
                    setDateEntered(e.target.value);
                    setLeaveDateError(undefined);
                  }}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <FieldLabel>Date extended</FieldLabel>
                <input
                  type="date"
                  value={dateExtended}
                  onChange={(e) => onDateExtendedChange(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <SwitchField
              label="Extension done"
              checked={extensionDone}
              onChange={setExtensionDone}
            />

            <label className="block">
              <FieldLabel required={status === "Finished"}>
                Leave date
              </FieldLabel>
              <input
                type="date"
                required={status === "Finished"}
                value={actualLeaveDate}
                min={dateEntered || undefined}
                onChange={(e) => {
                  setActualLeaveDate(e.target.value);
                  setLeaveDateError(undefined);
                }}
                className={leaveDateError ? inputErrorClass : inputClass}
                aria-invalid={Boolean(leaveDateError)}
              />
              <p className="mt-1 text-xs text-muted">{leaveDateHint}</p>
              <FieldError message={leaveDateError} />
            </label>

            <div className="rounded-lg border border-line bg-paper px-3 py-3">
              <p className="meta">Derived</p>
              <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Extension due</dt>
                  <dd className="mt-0.5 text-sm font-medium text-ink">
                    {previewDateToExtension
                      ? formatDisplayDate(previewDateToExtension)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Leave by</dt>
                  <dd className="mt-0.5 text-sm font-medium text-ink">
                    {previewLeaveReminder
                      ? formatDisplayDate(previewLeaveReminder)
                      : "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted">
                Calculated from date entered and {visa.visa_days}. Change visa
                days in the full editor.
              </p>
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

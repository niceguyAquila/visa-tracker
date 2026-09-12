import {
  VISA_ARCHIVE_STATE_OPTIONS,
  VISA_STATE_OPTIONS,
} from "../../lib/visa";
import type { VisaStatus } from "../../types";

function statusBadgeClass(status: VisaStatus): string {
  switch (status) {
    case "In-Progress":
      return "bg-blue-100 text-blue-900";
    case "Cuti":
      return "bg-violet-100 text-violet-900";
    case "Blacklist":
      return "bg-red-100 text-red-900";
    case "Finished":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function segmentClass(active: boolean, status: VisaStatus): string {
  const base =
    "flex-1 rounded-md px-2 py-2 text-center text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300";
  if (!active) {
    return `${base} text-slate-600 hover:bg-white hover:text-slate-900`;
  }
  switch (status) {
    case "Cuti":
      return `${base} bg-violet-100 text-violet-900 shadow-sm`;
    case "Blacklist":
      return `${base} bg-red-100 text-red-900 shadow-sm`;
    case "Finished":
      return `${base} bg-slate-200 text-slate-800 shadow-sm`;
    default:
      return `${base} bg-white text-blue-700 shadow-sm`;
  }
}

function ArchiveWarning({ status }: { status: VisaStatus }) {
  if (status === "Finished") {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Moves this visa to Archive. Another In-Progress visa can then be added
        for this customer.
      </p>
    );
  }
  if (status === "Cuti" || status === "Blacklist") {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        This status moves the visa to Archive (no longer listed under Active).
      </p>
    );
  }
  return null;
}

function VisaStateSegmented({
  value,
  onChange,
  options,
}: {
  value: VisaStatus | null;
  onChange: (next: VisaStatus) => void;
  options: VisaStatus[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Visa state"
      className="mt-1 flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 sm:flex-row"
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className={segmentClass(active, opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

type VisaStatusFieldsProps = {
  visaState: VisaStatus;
  onVisaStateChange: (next: VisaStatus) => void;
  isEdit: boolean;
  markAsOpen: boolean;
  onMarkAsOpenChange: (open: boolean) => void;
};

export function VisaStatusFields({
  visaState,
  onVisaStateChange,
  isEdit,
  markAsOpen,
  onMarkAsOpenChange,
}: VisaStatusFieldsProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">Visa state</span>
        <span
          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${statusBadgeClass(visaState)}`}
        >
          {visaState}
        </span>
      </div>

      {isEdit ? (
        <>
          <VisaStateSegmented
            value={visaState}
            onChange={onVisaStateChange}
            options={VISA_STATE_OPTIONS}
          />
          <ArchiveWarning status={visaState} />
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            New visas start as{" "}
            <span className="font-medium text-slate-800">In-Progress</span>{" "}
            (Active list).
          </p>

          {visaState === "In-Progress" && !markAsOpen ? (
            <button
              type="button"
              onClick={() => onMarkAsOpenChange(true)}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Mark as…
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">Mark as…</span>
                {visaState !== "In-Progress" ? (
                  <button
                    type="button"
                    onClick={() => {
                      onVisaStateChange("In-Progress");
                      onMarkAsOpenChange(false);
                    }}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Back to In-Progress
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onMarkAsOpenChange(false)}
                    className="text-sm font-medium text-slate-500 hover:underline"
                  >
                    Close
                  </button>
                )}
              </div>
              <VisaStateSegmented
                value={
                  VISA_ARCHIVE_STATE_OPTIONS.includes(visaState)
                    ? visaState
                    : null
                }
                onChange={onVisaStateChange}
                options={VISA_ARCHIVE_STATE_OPTIONS}
              />
              {visaState === "In-Progress" ? (
                <p className="text-xs text-slate-500">
                  Choose Cuti, Blacklist, or Finished to archive on create.
                </p>
              ) : (
                <ArchiveWarning status={visaState} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

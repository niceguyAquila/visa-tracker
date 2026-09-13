import {
  VISA_ARCHIVE_STATE_OPTIONS,
  VISA_STATE_OPTIONS,
} from "../../lib/visa";
import { statusBadgeClass, statusSegmentActiveClass } from "../../lib/ui";
import type { VisaStatus } from "../../types";

function segmentClass(active: boolean, status: VisaStatus): string {
  const base =
    "flex-1 rounded-md px-2 py-2 text-center text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";
  if (!active) {
    return `${base} text-muted hover:bg-surface hover:text-ink`;
  }
  return `${base} ${statusSegmentActiveClass(status)}`;
}

function ArchiveWarning({ status }: { status: VisaStatus }) {
  if (status === "Finished") {
    return (
      <p className="callout-warn px-3 py-2">
        Moves this visa to Archive. Another In-Progress visa can then be added
        for this customer.
      </p>
    );
  }
  if (status === "Cuti" || status === "Blacklist") {
    return (
      <p className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-muted">
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
      className="mt-1 flex flex-col gap-1 rounded-lg border border-line bg-paper p-1 sm:flex-row"
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
        <span className="text-sm font-medium text-ink-soft">Visa state</span>
        <span
          className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${statusBadgeClass(visaState)}`}
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
          <p className="text-sm text-muted">
            New visas start as{" "}
            <span className="font-medium text-ink">In-Progress</span>{" "}
            (Active list).
          </p>

          {visaState === "In-Progress" && !markAsOpen ? (
            <button
              type="button"
              onClick={() => onMarkAsOpenChange(true)}
              className="link-brand text-sm"
            >
              Mark as…
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-line bg-paper p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink-soft">Mark as…</span>
                {visaState !== "In-Progress" ? (
                  <button
                    type="button"
                    onClick={() => {
                      onVisaStateChange("In-Progress");
                      onMarkAsOpenChange(false);
                    }}
                    className="link-brand text-sm"
                  >
                    Back to In-Progress
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onMarkAsOpenChange(false)}
                    className="text-sm font-medium text-muted hover:underline"
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
                <p className="text-xs text-muted">
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

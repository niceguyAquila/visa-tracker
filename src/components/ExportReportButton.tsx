import { useState } from "react";
import { downloadCustomerVisaReport } from "../lib/report";

type ExportReportButtonProps = {
  companyId?: string | null;
  companyName?: string | null;
  disabled?: boolean;
};

export function ExportReportButton({
  companyId,
  companyName,
  disabled = false,
}: ExportReportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      await downloadCustomerVisaReport({ companyId, companyName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      <button
        type="button"
        className="btn-ghost"
        disabled={disabled || busy}
        onClick={() => void onClick()}
      >
        {busy ? "Preparing…" : "Download report"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

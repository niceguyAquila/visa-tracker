import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import type { VisaRecord, Worker } from "../types";

type WorkerRow = Worker & { visa_records: VisaRecord[] | null };

function nextExpiry(visas: VisaRecord[]): VisaRecord | null {
  if (!visas.length) return null;
  const sorted = [...visas].sort(
    (a, b) => parseISODateNum(a.expiry_date) - parseISODateNum(b.expiry_date)
  );
  return sorted[0] ?? null;
}

function parseISODateNum(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function urgencyClass(days: number): string {
  if (days < 0) return "bg-red-100 text-red-900";
  if (days <= 10) return "bg-amber-100 text-amber-900";
  if (days <= 30) return "bg-yellow-50 text-yellow-900";
  return "bg-slate-100 text-slate-700";
}

export function Dashboard() {
  const [rows, setRows] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("workers")
      .select("*, visa_records(*)")
      .order("full_name", { ascending: true });

    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows((data ?? []) as WorkerRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const va = a.visa_records ?? [];
      const vb = b.visa_records ?? [];
      const na = nextExpiry(va);
      const nb = nextExpiry(vb);
      if (!na && !nb) return a.full_name.localeCompare(b.full_name);
      if (!na) return 1;
      if (!nb) return -1;
      return parseISODateNum(na.expiry_date) - parseISODateNum(nb.expiry_date);
    });
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Workers</h1>
          <p className="text-sm text-slate-600">
            Track visa expiry dates. Email reminders go out{" "}
            <span className="font-medium">10 days before</span> expiry (UTC date).
          </p>
        </div>
        <Link
          to="/workers/new"
          className="inline-flex justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          Add worker
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
          No workers yet. Add a worker to start tracking visas.
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((w) => {
            const visas = w.visa_records ?? [];
            const next = nextExpiry(visas);
            const d = next ? daysUntilISODate(next.expiry_date) : null;
            return (
              <li key={w.id}>
                <Link
                  to={`/workers/${w.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{w.full_name}</p>
                      {w.employer_ref ? (
                        <p className="text-sm text-slate-500">{w.employer_ref}</p>
                      ) : null}
                    </div>
                    {next ? (
                      <div
                        className={`inline-flex flex-col rounded-lg px-3 py-2 text-sm sm:items-end ${urgencyClass(d ?? 0)}`}
                      >
                        <span className="font-medium">
                          {next.visa_label} · {formatDisplayDate(next.expiry_date)}
                        </span>
                        <span className="text-xs opacity-90">
                          {d !== null && d < 0
                            ? `Expired ${Math.abs(d)}d ago`
                            : d === 0
                              ? "Expires today (UTC)"
                              : `${d}d until expiry (UTC)`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">No visa on file</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

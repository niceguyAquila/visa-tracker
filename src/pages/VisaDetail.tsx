import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CompanyChip } from "../components/CompanyChip";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import { supabase } from "../lib/supabase";
import { statusBadgeClass, urgencyClass } from "../lib/ui";
import type { VisaWithCustomer } from "../types";

const VISA_SELECT =
  "*, customers ( id, full_name, passport_number, company_id, companies ( id, name, color ) )";

function relativeLabel(
  days: number,
  kind: "extension" | "leave"
): string {
  if (days < 0) return `Passed ${Math.abs(days)}d ago`;
  if (days === 0) return "Due today (UTC)";
  return kind === "extension"
    ? `${days}d until extension (UTC)`
    : `${days}d until leave (UTC)`;
}

type TimelineStepProps = {
  label: string;
  date: string | null;
  days?: number | null;
  kind?: "extension" | "leave";
  muted?: boolean;
};

function TimelineStep({
  label,
  date,
  days = null,
  kind = "extension",
  muted = false,
}: TimelineStepProps) {
  const hasUrgency = date && days !== null;
  const chipClass = hasUrgency
    ? urgencyClass(days)
    : muted
      ? "bg-paper text-muted"
      : "bg-ok-soft text-ink";

  return (
    <div className="min-w-0 flex-1">
      <p className="meta">
        {label}
      </p>
      <div
        className={`mt-1.5 inline-flex w-full flex-col rounded-lg px-3 py-2 text-sm ${chipClass}`}
      >
        {date ? (
          <>
            <span className="font-medium">{formatDisplayDate(date)}</span>
            {hasUrgency ? (
              <span className="text-xs opacity-90">
                {relativeLabel(days, kind)}
              </span>
            ) : null}
          </>
        ) : (
          <span className="font-medium">—</span>
        )}
      </div>
    </div>
  );
}

function TimelineConnector() {
  return (
    <div
      className="hidden w-6 shrink-0 self-center sm:block"
      aria-hidden="true"
    >
      <div className="h-px w-full bg-line" />
    </div>
  );
}

export function VisaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [visa, setVisa] = useState<VisaWithCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashSuccess, setFlashSuccess] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { flashSuccess?: string } | null;
    if (state?.flashSuccess) {
      setFlashSuccess(state.flashSuccess);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("visas")
      .select(VISA_SELECT)
      .eq("id", id)
      .single();
    if (qErr || !data) {
      setError(qErr?.message ?? "Not found");
      setVisa(null);
      setLoading(false);
      return;
    }
    setVisa(data as VisaWithCustomer);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeVisa() {
    if (!id) return;
    if (!confirm("Delete this visa record?")) return;
    const { error: dErr } = await supabase.from("visas").delete().eq("id", id);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    navigate(
      visa?.status === "In-Progress" ? "/visas/active" : "/visas/archive"
    );
  }

  if (!id) return null;

  if (loading) {
    return <p className="text-muted">Loading…</p>;
  }

  if (!visa) {
    return (
      <div className="space-y-2">
        <p className="text-red-700">{error ?? "Not found"}</p>
        <Link
          to="/visas/active"
          className="link-brand text-sm"
        >
          ← Back to list
        </Link>
      </div>
    );
  }

  const listPath =
    visa.status === "In-Progress" ? "/visas/active" : "/visas/archive";
  const extDays = daysUntilISODate(visa.date_to_extension);
  const leaveDays = visa.leave_date_reminder
    ? daysUntilISODate(visa.leave_date_reminder)
    : null;

  return (
    <div className="space-y-6">
      {flashSuccess ? (
        <p className="flash-success">
          {flashSuccess}
        </p>
      ) : null}
      <div>
        <Link
          to={listPath}
          className="link-brand text-sm"
        >
          ← {visa.status === "In-Progress" ? "Active visas" : "Archive"}
        </Link>

        <div className="mt-2 flex flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-title truncate">
              {visa.customers?.full_name ?? "Visa"}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
              {visa.customers?.companies ? (
                <CompanyChip
                  name={visa.customers.companies.name}
                  color={visa.customers.companies.color}
                />
              ) : (
                <span>—</span>
              )}
              <span>· {visa.visa_days}</span>
            </p>
            <span
              className={`mt-2 inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${statusBadgeClass(visa.status)}`}
            >
              {visa.status}
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Link
              to={`/visas/${id}/edit`}
              className="btn-ghost"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={() => void removeVisa()}
              className="btn-danger"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">Timeline</h2>
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
              visa.extension_done
                ? "bg-success-soft text-success-ink"
                : "bg-ok-soft text-ok-ink"
            }`}
          >
            Extension {visa.extension_done ? "done" : "not done"}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <TimelineStep label="Entered" date={visa.date_entered} />
          <TimelineConnector />
          <TimelineStep
            label="Ext. due"
            date={visa.date_to_extension}
            days={extDays}
            kind="extension"
          />
          <TimelineConnector />
          <TimelineStep
            label="Extended"
            date={visa.date_extended}
            muted={!visa.date_extended}
          />
          <TimelineConnector />
          <TimelineStep
            label="Leave"
            date={visa.leave_date_reminder}
            days={leaveDays}
            kind="leave"
            muted={!visa.leave_date_reminder}
          />
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-sm font-semibold text-ink">Details</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="meta">
              Passport number
            </dt>
            <dd className="mt-1 font-mono text-sm text-ink">
              {visa.customers?.passport_number ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="meta">
              Company
            </dt>
            <dd className="mt-1 text-ink">
              {visa.customers?.companies ? (
                <CompanyChip
                  name={visa.customers.companies.name}
                  color={visa.customers.companies.color}
                />
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="meta">
              Customer
            </dt>
            <dd className="mt-1">
              {visa.customers ? (
                <Link
                  to={`/customers/${visa.customer_id}`}
                  className="link-brand"
                >
                  {visa.customers.full_name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="meta">
              Masuk dari
            </dt>
            <dd className="mt-1 text-ink">{visa.masuk_dari || "—"}</dd>
          </div>
          <div>
            <dt className="meta">
              Visa days
            </dt>
            <dd className="mt-1 text-ink">{visa.visa_days}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

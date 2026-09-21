import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CompanyChip } from "../components/CompanyChip";
import { VisaRouteDisplay } from "../components/VisaRoute";
import { VisaTimeline } from "../components/VisaTimeline";
import { VisaQuickEdit } from "../components/VisaQuickEdit";
import { usePageHeader } from "../context/PageHeaderContext";
import { formatDisplayDate, formatOptionalDisplayDate } from "../lib/dates";
import { embedOne, EVISA_EMBED } from "../lib/evisa";
import { removeEvisaPdf, signedEvisaUrl } from "../lib/evisaPdf";
import { supabase } from "../lib/supabase";
import {
  statusBadgeClass,
  landedBadgeClass,
  landedLabel,
  leavePhaseBadgeClass,
} from "../lib/ui";
import { deriveLeavePhase, isVisaLanded, leavePhaseLabel } from "../lib/visa";
import { finishDueVisas } from "../lib/visaSweep";
import type { EVisa, VisaWithCustomer } from "../types";

const VISA_SELECT =
  `*, customers ( id, full_name, company_id, companies ( id, name, color ) ), passports!passport_id ( id, passport_number, passport_expiry ), ${EVISA_EMBED}`;

export function VisaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [visa, setVisa] = useState<VisaWithCustomer | null>(null);
  const [evisa, setEvisa] = useState<EVisa | null>(null);
  const [evisaOpen, setEvisaOpen] = useState(false);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
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
    await finishDueVisas();
    const { data, error: qErr } = await supabase
      .from("visas")
      .select(VISA_SELECT)
      .eq("id", id)
      .single();
    if (qErr || !data) {
      setError(qErr?.message ?? "Not found");
      setVisa(null);
      setEvisa(null);
      setLoading(false);
      return;
    }
    setVisa(data as VisaWithCustomer);
    setEvisa(embedOne((data as VisaWithCustomer).e_visas));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!evisaOpen) {
      setPdfOpen(false);
      setPdfUrl(null);
      setPdfLoading(false);
      setPdfError(null);
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (pdfOpen) {
        setPdfOpen(false);
        return;
      }
      setEvisaOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [evisaOpen, pdfOpen]);

  async function viewEvisaFile() {
    if (!evisa?.file_path) return;
    setPdfOpen(true);
    setPdfError(null);
    if (pdfUrl) return;
    setPdfLoading(true);
    const url = await signedEvisaUrl(evisa.file_path);
    setPdfLoading(false);
    if (!url) {
      setPdfError("Couldn’t load the PDF.");
      return;
    }
    setPdfUrl(url);
  }

  async function removeEvisa() {
    if (!evisa) return;
    if (!confirm("Delete this e-visa record?")) return;
    await removeEvisaPdf(evisa.file_path);
    const { error: dErr } = await supabase
      .from("e_visas")
      .delete()
      .eq("id", evisa.id);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    setEvisa(null);
    setEvisaOpen(false);
    setFlashSuccess("e-Visa deleted.");
  }

  async function removeVisa() {
    if (!id) return;
    if (!confirm("Delete this visa record?")) return;
    await removeEvisaPdf(evisa?.file_path);
    const { error: dErr } = await supabase.from("visas").delete().eq("id", id);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    navigate("/visas/active");
  }

  const listPath = "/visas/active";

  usePageHeader({
    title: visa?.customers?.full_name ?? "Visa",
    backTo: listPath,
    backLabel: "Arrived",
  });

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

  const landed = isVisaLanded(visa.date_entered);
  const leavePhase = deriveLeavePhase(visa.actual_leave_date);

  return (
    <div className="space-y-6">
      {flashSuccess ? (
        <p className="flash-success">
          {flashSuccess}
        </p>
      ) : null}
      <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {visa.customers?.companies ? (
            <CompanyChip
              name={visa.customers.companies.name}
              color={visa.customers.companies.color}
            />
          ) : (
            <span className="text-sm text-muted">No company</span>
          )}
          <span className="text-sm text-ink-soft">{visa.visa_days}</span>
          <span
            className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${statusBadgeClass(visa.status)}`}
          >
            {visa.status}
          </span>
          {visa.status === "In-Progress" ? (
            <span
              className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${landedBadgeClass(landed)}`}
            >
              {landedLabel(landed)}
            </span>
          ) : null}
          {leavePhase === "confirmed" ? (
            <span
              className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${leavePhaseBadgeClass(leavePhase)}`}
            >
              {leavePhaseLabel(leavePhase)}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link to={`/visas/${id}/edit`} className="btn-ghost px-3 py-1.5">
            Edit
          </Link>
          <button
            type="button"
            onClick={() => void removeVisa()}
            className="btn-danger px-3 py-1.5"
          >
            Delete
          </button>
        </div>
      </div>


      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {visa.status === "In-Progress" && !landed ? (
        <p className="callout-warn">
          Visa is ready, but this customer is still waiting. Add{" "}
          <span className="font-medium">Date entered</span> when they arrive.
        </p>
      ) : null}

      <VisaTimeline
        visa={visa}
        action={
          <button
            type="button"
            className="btn-ghost px-3 py-1.5"
            onClick={() => setQuickEditOpen(true)}
          >
            Quick edit
          </button>
        }
      />

      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Details</h2>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5"
            onClick={() => setEvisaOpen(true)}
          >
            {evisa ? "View e-visa" : "Add e-visa"}
          </button>
        </div>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="meta">
              Passport number
            </dt>
            <dd className="mt-1 font-mono text-sm text-ink">
              {visa.passports?.passport_number ?? "—"}
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
          <div className="sm:col-span-2">
            <dt className="meta">Route</dt>
            <dd className="mt-2">
              <VisaRouteDisplay
                route={visa.route}
                exitRoute={visa.exit_route}
              />
            </dd>
          </div>
          <div>
            <dt className="meta">
              Visa days
            </dt>
            <dd className="mt-1 text-ink">{visa.visa_days}</dd>
          </div>
          <div>
            <dt className="meta">Leave date</dt>
            <dd className="mt-1 text-ink">
              {formatOptionalDisplayDate(visa.actual_leave_date)}
              {leavePhase !== "none" ? (
                <span className="ml-2 text-sm text-muted">
                  {leavePhaseLabel(leavePhase)}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      {quickEditOpen ? (
        <VisaQuickEdit
          visa={visa}
          onClose={() => setQuickEditOpen(false)}
          onSaved={(message) => {
            setQuickEditOpen(false);
            setFlashSuccess(message);
            void load();
          }}
        />
      ) : null}

      {evisaOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="evisa-dialog-title"
          onClick={() => setEvisaOpen(false)}
        >
          <div
            className="panel flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 id="evisa-dialog-title" className="text-sm font-semibold text-ink">
                  e-Visa
                </h2>
                {evisa ? (
                  <p className="mt-0.5 truncate font-mono text-sm text-muted">
                    {evisa.evisa_number}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {evisa ? (
                  <>
                    {evisa.file_path ? (
                      <button
                        type="button"
                        className="btn-ghost px-3 py-1.5"
                        disabled={pdfLoading}
                        onClick={() => void viewEvisaFile()}
                      >
                        {pdfLoading ? "Loading file…" : "View e-visa file"}
                      </button>
                    ) : null}
                    <Link
                      to={`/visas/${id}/evisa`}
                      className="btn-ghost px-3 py-1.5"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void removeEvisa()}
                      className="btn-danger px-3 py-1.5"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <Link
                    to={`/visas/${id}/evisa`}
                    className="btn-primary px-3 py-1.5"
                  >
                    Add e-visa
                  </Link>
                )}
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5"
                  onClick={() => setEvisaOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4">
              {evisa ? (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="meta">eVISA number</dt>
                    <dd className="mt-1 font-mono text-sm text-ink">
                      {evisa.evisa_number}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">Ref. number</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {evisa.ref_number || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">eVISA issue date</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {formatDisplayDate(evisa.issue_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">eVISA expire date</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {formatDisplayDate(evisa.expire_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">Place of issue</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {evisa.place_of_issue || "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="meta">Remarks</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">
                      {evisa.remarks || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">Gender</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {evisa.gender || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">Full name</dt>
                    <dd className="mt-1 text-sm text-ink">{evisa.full_name}</dd>
                  </div>
                  <div>
                    <dt className="meta">Date of birth</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {formatOptionalDisplayDate(evisa.date_of_birth)}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">Nationality</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {evisa.nationality || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">Travel document</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {evisa.travel_document}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">Travel doc. no</dt>
                    <dd className="mt-1 font-mono text-sm text-ink">
                      {evisa.travel_doc_no}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">Travel doc. issue</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {formatOptionalDisplayDate(evisa.travel_doc_issue)}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta">Travel doc. expiry</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {formatOptionalDisplayDate(evisa.travel_doc_expiry)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted">No e-visa recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {pdfOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="evisa-file-dialog-title"
          onClick={() => setPdfOpen(false)}
        >
          <div
            className="panel flex h-full max-h-dvh w-full max-w-4xl flex-col overflow-hidden rounded-none sm:h-[90dvh] sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-line p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:flex-row sm:items-start sm:justify-between sm:pt-4">
              <div className="min-w-0">
                <h2
                  id="evisa-file-dialog-title"
                  className="text-sm font-semibold text-ink"
                >
                  e-Visa file
                </h2>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {evisa?.file_name || evisa?.evisa_number}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {pdfUrl ? (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost px-3 py-1.5"
                  >
                    Open in new tab
                  </a>
                ) : null}
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5"
                  onClick={() => setPdfOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {pdfLoading ? (
                <p className="text-sm text-muted" role="status">
                  Loading file…
                </p>
              ) : pdfUrl ? (
                <iframe
                  title="e-visa PDF"
                  src={pdfUrl}
                  className="h-full min-h-[12rem] w-full rounded-lg border border-line bg-paper"
                />
              ) : (
                <p className="text-sm text-muted">
                  {pdfError ?? "Couldn’t load the PDF."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

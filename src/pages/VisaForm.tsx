import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { formatDisplayDate } from "../lib/dates";
import { getDefaultOrgId } from "../lib/org";
import {
  computeDateToExtension,
  computeLeaveDateReminder,
  computeVisaStatus,
  flagsFromVisaStatus,
  friendlyInProgressConflict,
  VISA_ARCHIVE_STATE_OPTIONS,
  VISA_DAYS_OPTIONS,
  VISA_STATE_OPTIONS,
} from "../lib/visa";
import { supabase } from "../lib/supabase";
import type { CustomerWithCompany, Visa, VisaDays, VisaStatus } from "../types";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

const readOnlyClass =
  "mt-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800";

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

export function VisaForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerWithCompany[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [visaDays, setVisaDays] = useState<VisaDays>("90 Days");
  const [dateEntered, setDateEntered] = useState("");
  const [dateExtended, setDateExtended] = useState("");
  const [extensionDone, setExtensionDone] = useState(false);
  const [visaState, setVisaState] = useState<VisaStatus>("In-Progress");
  const [markAsOpen, setMarkAsOpen] = useState(false);
  const [masukDari, setMasukDari] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { orgId: defaultOrgId, error: orgErr } = await getDefaultOrgId();
      if (cancelled) return;
      if (orgErr || !defaultOrgId) {
        setError(orgErr ?? "No organization found.");
        setLoading(false);
        return;
      }
      setOrgId(defaultOrgId);

      const { data: custRows, error: cErr } = await supabase
        .from("customers")
        .select("*, companies ( id, name )")
        .order("full_name", { ascending: true });
      if (cancelled) return;
      if (cErr) {
        setError(cErr.message);
        setLoading(false);
        return;
      }
      setCustomers((custRows ?? []) as CustomerWithCompany[]);

      if (!id) {
        const preselect = searchParams.get("customer") ?? "";
        if (preselect) setCustomerId(preselect);
        setVisaState("In-Progress");
        setMarkAsOpen(false);
        setLoading(false);
        return;
      }

      const { data: row, error: rowErr } = await supabase
        .from("visas")
        .select("*")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (rowErr || !row) {
        setError(rowErr?.message ?? "Visa not found.");
        setLoading(false);
        return;
      }
      const visa = row as Visa;
      setCustomerId(visa.customer_id);
      setVisaDays(visa.visa_days);
      setDateEntered(visa.date_entered);
      setDateExtended(visa.date_extended ?? "");
      setExtensionDone(visa.extension_done);
      setVisaState(
        computeVisaStatus({
          cycle_done: visa.cycle_done,
          blacklist: visa.blacklist,
          cuti: visa.cuti,
        })
      );
      setMasukDari(visa.masuk_dari);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId]
  );

  const previewDateToExtension = computeDateToExtension(dateEntered, visaDays);
  const previewLeaveReminder = computeLeaveDateReminder(dateExtended || null);

  function onDateExtendedChange(value: string) {
    setDateExtended(value);
    if (value) setExtensionDone(true);
  }

  function onExtensionDoneChange(checked: boolean) {
    setExtensionDone(checked);
  }

  function onVisaStateChange(next: VisaStatus) {
    setVisaState(next);
    if (!isEdit && next !== "In-Progress") {
      setMarkAsOpen(true);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    if (!customerId) {
      setError("Customer is required.");
      return;
    }
    if (!dateEntered) {
      setError("Date entered is required.");
      return;
    }

    setError(null);
    setBusy(true);

    const flags = flagsFromVisaStatus(visaState);
    const payload = {
      customer_id: customerId,
      visa_days: visaDays,
      date_entered: dateEntered,
      date_extended: dateExtended || null,
      extension_done: extensionDone,
      cycle_done: flags.cycle_done,
      cuti: flags.cuti,
      blacklist: flags.blacklist,
      masuk_dari: masukDari.trim(),
    };

    if (isEdit && id) {
      const { error: uErr } = await supabase
        .from("visas")
        .update(payload)
        .eq("id", id);
      setBusy(false);
      if (uErr) {
        setError(friendlyInProgressConflict(uErr.message));
        return;
      }
      navigate(`/visas/${id}`);
      return;
    }

    const { data, error: iErr } = await supabase
      .from("visas")
      .insert({
        org_id: orgId,
        ...payload,
      })
      .select("id")
      .single();

    setBusy(false);
    if (iErr || !data) {
      setError(
        friendlyInProgressConflict(iErr?.message ?? "Could not create visa.")
      );
      return;
    }
    navigate(`/visas/${(data as { id: string }).id}`);
  }

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={isEdit && id ? `/visas/${id}` : "/visas/active"}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {isEdit ? "Edit visa" : "New visa"}
        </h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Customer</span>
          {customers.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              No customers yet.{" "}
              <Link
                to="/customers/new"
                className="font-medium text-blue-600 hover:underline"
              >
                Create a customer
              </Link>{" "}
              first.
            </p>
          ) : (
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={isEdit}
              className={inputClass}
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                  {c.companies?.name ? ` · ${c.companies.name}` : ""}
                </option>
              ))}
            </select>
          )}
        </label>

        {selectedCustomer ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Name
              </span>
              <p className={readOnlyClass}>{selectedCustomer.full_name}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Passport
              </span>
              <p className={readOnlyClass}>{selectedCustomer.passport_number}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Company
              </span>
              <p className={readOnlyClass}>
                {selectedCustomer.companies?.name ?? "—"}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Visa days</span>
            <select
              required
              value={visaDays}
              onChange={(e) => setVisaDays(e.target.value as VisaDays)}
              className={inputClass}
            >
              {VISA_DAYS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Date entered</span>
            <input
              type="date"
              required
              value={dateEntered}
              onChange={(e) => setDateEntered(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Date to extension
            </span>
            <p className={readOnlyClass}>
              {previewDateToExtension
                ? formatDisplayDate(previewDateToExtension)
                : "—"}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Leave date reminder
            </span>
            <p className={readOnlyClass}>
              {previewLeaveReminder
                ? formatDisplayDate(previewLeaveReminder)
                : "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Date extended</span>
            <input
              type="date"
              value={dateExtended}
              onChange={(e) => onDateExtendedChange(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              Setting a date marks extension as done. You can still toggle that
              manually.
            </p>
          </label>

          <div className="flex flex-col justify-end">
            <button
              type="button"
              role="switch"
              aria-checked={extensionDone}
              onClick={() => onExtensionDoneChange(!extensionDone)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                extensionDone
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>Extension done</span>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
                  extensionDone ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition ${
                    extensionDone ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Masuk dari</span>
          <input
            value={masukDari}
            onChange={(e) => setMasukDari(e.target.value)}
            placeholder="Port of entry"
            className={inputClass}
          />
        </label>

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
                  onClick={() => setMarkAsOpen(true)}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Mark as…
                </button>
              ) : (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      Mark as…
                    </span>
                    {visaState !== "In-Progress" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setVisaState("In-Progress");
                          setMarkAsOpen(false);
                        }}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Back to In-Progress
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMarkAsOpen(false)}
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

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !orgId || customers.length === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
        >
          {busy ? "Saving…" : isEdit ? "Save" : "Create visa"}
        </button>
      </form>
    </div>
  );
}

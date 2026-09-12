import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PhoneInput } from "../components/PhoneInput";
import { formatDisplayDate } from "../lib/dates";
import { getDefaultOrgId } from "../lib/org";
import {
  composePhone,
  DEFAULT_DIAL,
  parseStoredPhone,
  validatePhone,
} from "../lib/phone";
import { supabase } from "../lib/supabase";
import {
  computeDateToExtension,
  computeLeaveDateReminder,
  flagsFromVisaStatus,
  friendlyInProgressConflict,
  VISA_DAYS_OPTIONS,
} from "../lib/visa";
import type { Company, Customer, VisaDays } from "../types";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

const readOnlyClass =
  "mt-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800";

export function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [fullName, setFullName] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportExpiry, setPassportExpiry] = useState("");
  const [visaCount, setVisaCount] = useState(0);
  const [extensionCount, setExtensionCount] = useState(0);
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL.code);
  const [localNumber, setLocalNumber] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [addFirstVisa, setAddFirstVisa] = useState(true);
  const [visaDays, setVisaDays] = useState<VisaDays>("90 Days");
  const [dateEntered, setDateEntered] = useState("");
  const [dateExtended, setDateExtended] = useState("");
  const [extensionDone, setExtensionDone] = useState(false);
  const [masukDari, setMasukDari] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { orgId: defaultOrgId, error: orgErr } = await getDefaultOrgId();
      if (cancelled) return;
      if (orgErr || !defaultOrgId) {
        setError(orgErr ?? "No organization found.");
        return;
      }
      setOrgId(defaultOrgId);

      const { data: cos, error: cErr } = await supabase
        .from("companies")
        .select("*")
        .order("name", { ascending: true });
      if (cancelled) return;
      if (cErr) {
        setError(cErr.message);
        return;
      }
      setCompanies((cos ?? []) as Company[]);

      if (!id) return;

      const { data: row, error: rowErr } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (rowErr || !row) {
        setError(rowErr?.message ?? "Customer not found.");
        return;
      }
      const customer = row as Customer;
      setFullName(customer.full_name);
      setPassportNumber(customer.passport_number);
      setPassportExpiry(customer.passport_expiry);
      setVisaCount(customer.visa_count);
      setExtensionCount(customer.extension_count);
      const parsed = parseStoredPhone(customer.contact_number);
      setDialCode(parsed.dialCode);
      setLocalNumber(parsed.local);
      setCompanyId(customer.company_id);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const previewDateToExtension = computeDateToExtension(dateEntered, visaDays);
  const previewLeaveReminder = computeLeaveDateReminder(dateExtended || null);

  function onDateExtendedChange(value: string) {
    setDateExtended(value);
    if (value) setExtensionDone(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    if (!companyId) {
      setError("Company is required.");
      return;
    }

    const phoneErr = validatePhone(dialCode, localNumber);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }

    if (!isEdit && addFirstVisa && !dateEntered) {
      setError("Date entered is required.");
      return;
    }

    setError(null);
    setBusy(true);

    const payload = {
      full_name: fullName.trim(),
      passport_number: passportNumber.trim(),
      passport_expiry: passportExpiry,
      visa_count: Math.max(0, Math.floor(Number(visaCount)) || 0),
      extension_count: Math.max(0, Math.floor(Number(extensionCount)) || 0),
      contact_number: composePhone(dialCode, localNumber),
      company_id: companyId,
    };

    if (isEdit && id) {
      const { error: uErr } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", id);
      setBusy(false);
      if (uErr) {
        setError(uErr.message);
        return;
      }
      navigate(`/customers/${id}`);
      return;
    }

    const { data, error: iErr } = await supabase
      .from("customers")
      .insert({
        org_id: orgId,
        ...payload,
      })
      .select("id")
      .single();

    if (iErr || !data) {
      setBusy(false);
      setError(iErr?.message ?? "Could not create customer.");
      return;
    }

    const customerId = (data as { id: string }).id;

    if (addFirstVisa) {
      const flags = flagsFromVisaStatus("In-Progress");
      const { error: vErr } = await supabase.from("visas").insert({
        org_id: orgId,
        customer_id: customerId,
        visa_days: visaDays,
        date_entered: dateEntered,
        date_extended: dateExtended || null,
        extension_done: extensionDone,
        cycle_done: flags.cycle_done,
        cuti: flags.cuti,
        blacklist: flags.blacklist,
        masuk_dari: masukDari.trim(),
      });

      setBusy(false);
      if (vErr) {
        navigate(`/customers/${customerId}`, {
          state: {
            flashError: `Customer was created, but visa failed: ${friendlyInProgressConflict(vErr.message)}`,
          },
        });
        return;
      }
      navigate(`/customers/${customerId}`);
      return;
    }

    setBusy(false);
    navigate(`/customers/${customerId}`);
  }

  const submitLabel = isEdit
    ? "Save"
    : addFirstVisa
      ? "Create customer & visa"
      : "Create customer";

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={isEdit && id ? `/customers/${id}` : "/customers"}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {isEdit ? "Edit customer" : "New customer"}
        </h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Name</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Company</span>
          {companies.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              No companies yet.{" "}
              <Link to="/companies" className="font-medium text-blue-600 hover:underline">
                Create a company
              </Link>{" "}
              before adding a customer.
            </p>
          ) : (
            <select
              required
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a company…</option>
              {companies.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
          )}
          {companies.length > 0 ? (
            <p className="mt-1 text-xs text-slate-500">
              Need another?{" "}
              <Link to="/companies" className="text-blue-600 hover:underline">
                Manage companies
              </Link>
            </p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Passport number</span>
          <input
            required
            value={passportNumber}
            onChange={(e) => setPassportNumber(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Passport expiry date</span>
          <input
            type="date"
            required
            value={passportExpiry}
            onChange={(e) => setPassportExpiry(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Visa count</span>
            <input
              type="number"
              min={0}
              step={1}
              required
              value={visaCount}
              onChange={(e) => setVisaCount(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Extension count</span>
            <input
              type="number"
              min={0}
              step={1}
              required
              value={extensionCount}
              onChange={(e) => setExtensionCount(Number(e.target.value))}
              className={inputClass}
            />
          </label>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-700">Contact number</span>
          <PhoneInput
            required
            dialCode={dialCode}
            localNumber={localNumber}
            onDialCodeChange={setDialCode}
            onLocalNumberChange={setLocalNumber}
          />
          <p className="mt-1 text-xs text-slate-500">
            Digits only. Leading 0 is removed when saving (e.g. 0812… → +62812…).
          </p>
        </div>

        {!isEdit ? (
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">First visa</h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  {addFirstVisa ? (
                    <>
                      Starts as{" "}
                      <span className="font-medium text-slate-800">In-Progress</span>{" "}
                      (Active list).
                    </>
                  ) : (
                    "Turn on to enter visa details with this customer."
                  )}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={addFirstVisa}
                aria-label="Include first visa"
                onClick={() => setAddFirstVisa(!addFirstVisa)}
                className={`inline-flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  addFirstVisa
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{addFirstVisa ? "Included" : "Skipped"}</span>
                <span
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
                    addFirstVisa ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition ${
                      addFirstVisa ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>
            </div>

            {addFirstVisa ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Visa days</span>
                    <select
                      required={addFirstVisa}
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
                    <span className="text-sm font-medium text-slate-700">
                      Date entered
                    </span>
                    <input
                      type="date"
                      required={addFirstVisa}
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

                <div>
                  <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">
                        Date extended
                      </span>
                      <input
                        type="date"
                        value={dateExtended}
                        onChange={(e) => onDateExtendedChange(e.target.value)}
                        className={inputClass}
                      />
                    </label>

                    <div className="block">
                      <span className="text-sm font-medium text-slate-700">
                        Extension done
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={extensionDone}
                        onClick={() => setExtensionDone(!extensionDone)}
                        className={`mt-1 flex h-[42px] w-full items-center justify-between rounded-lg border px-3 text-sm font-medium transition ${
                          extensionDone
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>{extensionDone ? "Yes" : "No"}</span>
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
                  <p className="mt-1 text-xs text-slate-500">
                    Setting a date marks extension as done. You can still toggle that
                    manually.
                  </p>
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
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !orgId || companies.length === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PhoneInput } from "../components/PhoneInput";
import { getDefaultOrgId } from "../lib/org";
import {
  composePhone,
  DEFAULT_DIAL,
  parseStoredPhone,
  validatePhone,
} from "../lib/phone";
import { supabase } from "../lib/supabase";
import type { Company, Customer } from "../types";

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

    setBusy(false);
    if (iErr || !data) {
      setError(iErr?.message ?? "Could not create customer.");
      return;
    }
    navigate(`/customers/${(data as { id: string }).id}`);
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

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

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !orgId || companies.length === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
        >
          {busy ? "Saving…" : isEdit ? "Save" : "Create customer"}
        </button>
      </form>
    </div>
  );
}

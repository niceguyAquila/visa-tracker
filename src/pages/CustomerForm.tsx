import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  PersonFields,
  type PersonFieldsValue,
} from "../components/forms/PersonFields";
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

  const [orgId, setOrgId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [person, setPerson] = useState<PersonFieldsValue>({
    fullName: "",
    companyId: "",
    passportNumber: "",
    passportExpiry: "",
    visaCount: 0,
    extensionCount: 0,
    dialCode: DEFAULT_DIAL.code,
    localNumber: "",
  });
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

      const { data: cos, error: cErr } = await supabase
        .from("companies")
        .select("*")
        .order("name", { ascending: true });
      if (cancelled) return;
      if (cErr) {
        setError(cErr.message);
        setLoading(false);
        return;
      }
      setCompanies((cos ?? []) as Company[]);

      if (!id) {
        setError("Customer not found.");
        setLoading(false);
        return;
      }

      const { data: row, error: rowErr } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (rowErr || !row) {
        setError(rowErr?.message ?? "Customer not found.");
        setLoading(false);
        return;
      }
      const customer = row as Customer;
      const parsed = parseStoredPhone(customer.contact_number);
      setPerson({
        fullName: customer.full_name,
        companyId: customer.company_id,
        passportNumber: customer.passport_number,
        passportExpiry: customer.passport_expiry,
        visaCount: customer.visa_count,
        extensionCount: customer.extension_count,
        dialCode: parsed.dialCode,
        localNumber: parsed.local,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId || !id) return;
    if (!person.companyId) {
      setError("Company is required.");
      return;
    }

    const phoneErr = validatePhone(person.dialCode, person.localNumber);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }

    setError(null);
    setBusy(true);

    const { error: uErr } = await supabase
      .from("customers")
      .update({
        full_name: person.fullName.trim(),
        passport_number: person.passportNumber.trim(),
        passport_expiry: person.passportExpiry,
        visa_count: Math.max(0, Math.floor(Number(person.visaCount)) || 0),
        extension_count: Math.max(
          0,
          Math.floor(Number(person.extensionCount)) || 0
        ),
        contact_number: composePhone(person.dialCode, person.localNumber),
        company_id: person.companyId,
      })
      .eq("id", id);

    setBusy(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    navigate(`/customers/${id}`);
  }

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={id ? `/customers/${id}` : "/customers"}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Edit customer
        </h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <PersonFields
          value={person}
          companies={companies}
          onChange={(patch) => setPerson((prev) => ({ ...prev, ...patch }))}
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <Link
            to={id ? `/customers/${id}` : "/customers"}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy || !orgId || companies.length === 0}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

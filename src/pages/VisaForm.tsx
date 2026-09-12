import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PersonPicker } from "../components/forms/PersonPicker";
import { FormSection, SectionHeading } from "../components/forms/formStyles";
import {
  VisaFields,
  type VisaFieldsValue,
} from "../components/forms/VisaFields";
import { VisaStatusFields } from "../components/forms/VisaStatusFields";
import { getDefaultOrgId } from "../lib/org";
import {
  computeVisaStatus,
  flagsFromVisaStatus,
  friendlyInProgressConflict,
} from "../lib/visa";
import { supabase } from "../lib/supabase";
import type { CustomerWithCompany, Visa, VisaStatus } from "../types";

export function VisaForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerWithCompany[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [visa, setVisa] = useState<VisaFieldsValue>({
    visaDays: "90 Days",
    dateEntered: "",
    dateExtended: "",
    extensionDone: false,
    masukDari: "",
  });
  const [visaState, setVisaState] = useState<VisaStatus>("In-Progress");
  const [markAsOpen, setMarkAsOpen] = useState(false);
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
        setError("Visa not found.");
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
      const rowVisa = row as Visa;
      setCustomerId(rowVisa.customer_id);
      setVisa({
        visaDays: rowVisa.visa_days,
        dateEntered: rowVisa.date_entered,
        dateExtended: rowVisa.date_extended ?? "",
        extensionDone: rowVisa.extension_done,
        masukDari: rowVisa.masuk_dari,
      });
      setVisaState(
        computeVisaStatus({
          cycle_done: rowVisa.cycle_done,
          blacklist: rowVisa.blacklist,
          cuti: rowVisa.cuti,
        })
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId || !id) return;
    if (!customerId) {
      setError("Customer is required.");
      return;
    }
    if (!visa.dateEntered) {
      setError("Date entered is required.");
      return;
    }

    setError(null);
    setBusy(true);

    const flags = flagsFromVisaStatus(visaState);
    const { error: uErr } = await supabase
      .from("visas")
      .update({
        customer_id: customerId,
        visa_days: visa.visaDays,
        date_entered: visa.dateEntered,
        date_extended: visa.dateExtended || null,
        extension_done: visa.extensionDone,
        cycle_done: flags.cycle_done,
        cuti: flags.cuti,
        blacklist: flags.blacklist,
        masuk_dari: visa.masukDari.trim(),
      })
      .eq("id", id);

    setBusy(false);
    if (uErr) {
      setError(friendlyInProgressConflict(uErr.message));
      return;
    }
    navigate(`/visas/${id}`);
  }

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={id ? `/visas/${id}` : "/visas/active"}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Edit visa</h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <FormSection>
          <SectionHeading step={1} title="Customer" />
          <PersonPicker
            customers={customers}
            customerId={customerId}
            onCustomerIdChange={setCustomerId}
            disabled
          />
        </FormSection>

        <FormSection>
          <SectionHeading step={2} title="Visa" />
          <VisaFields
            value={visa}
            onChange={(patch) => setVisa((prev) => ({ ...prev, ...patch }))}
            required
            defaultMoreOpen
            moreDetailsExtra={
              <VisaStatusFields
                visaState={visaState}
                onVisaStateChange={setVisaState}
                isEdit
                markAsOpen={markAsOpen}
                onMarkAsOpenChange={setMarkAsOpen}
              />
            }
          />
        </FormSection>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <Link
            to={id ? `/visas/${id}` : "/visas/active"}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy || !orgId || customers.length === 0}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

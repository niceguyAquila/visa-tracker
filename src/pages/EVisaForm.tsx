import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EVisaFields } from "../components/forms/EVisaFields";
import { PassportSelect } from "../components/forms/PassportSelect";
import { FormSection, SectionHeading } from "../components/forms/formStyles";
import { CUSTOMER_LIST_SELECT } from "../lib/customer";
import {
  embedOne,
  emptyEVisaFields,
  evisaFromRow,
  evisaPayload,
  evisaUpdatePayload,
  friendlyEvisaConflict,
  snapshotFromPassport,
  validateEVisaFields,
  type EVisaFieldErrors,
  type EVisaFieldsValue,
} from "../lib/evisa";
import { supabase } from "../lib/supabase";
import type { CustomerWithCompany, EVisa, Visa } from "../types";

export function EVisaForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [visa, setVisa] = useState<Visa | null>(null);
  const [customer, setCustomer] = useState<CustomerWithCompany | null>(null);
  const [existing, setExisting] = useState<EVisa | null>(null);
  const [passportId, setPassportId] = useState("");
  const [fields, setFields] = useState<EVisaFieldsValue>(emptyEVisaFields);
  const [errors, setErrors] = useState<EVisaFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setFormError(null);

      const { data: visaRow, error: visaErr } = await supabase
        .from("visas")
        .select("*, e_visas!visa_id (*)")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (visaErr || !visaRow) {
        setFormError(visaErr?.message ?? "Visa not found.");
        setLoading(false);
        return;
      }

      const row = visaRow as Visa & { e_visas: EVisa | EVisa[] | null };
      const evisa = embedOne(row.e_visas);
      setVisa(row);
      setExisting(evisa);

      const { data: custRow, error: custErr } = await supabase
        .from("customers")
        .select(CUSTOMER_LIST_SELECT)
        .eq("id", row.customer_id)
        .single();
      if (cancelled) return;
      if (custErr || !custRow) {
        setFormError(custErr?.message ?? "Customer not found.");
        setLoading(false);
        return;
      }

      const customerRow = custRow as CustomerWithCompany;
      const passports = customerRow.passports ?? [];
      setCustomer({ ...customerRow, passports });

      if (evisa) {
        setPassportId(evisa.passport_id);
        setFields(evisaFromRow(evisa));
      } else {
        const defaultPassport =
          passports.find((p) => p.id === row.passport_id) ?? passports[0] ?? null;
        const nextId = defaultPassport?.id ?? "";
        setPassportId(nextId);
        setFields({
          ...emptyEVisaFields(),
          ...snapshotFromPassport(
            emptyEVisaFields(),
            defaultPassport,
            customerRow.full_name
          ),
        });
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function patchFields(patch: Partial<EVisaFieldsValue>) {
    setFields((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof EVisaFieldsValue)[]) {
        delete next[key];
      }
      return next;
    });
  }

  function onPassportChange(nextId: string) {
    setPassportId(nextId);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.passportId;
      return next;
    });
    const passport =
      customer?.passports?.find((p) => p.id === nextId) ?? null;
    setFields((prev) => ({
      ...prev,
      ...snapshotFromPassport(prev, passport, customer?.full_name ?? ""),
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!visa || !id) return;
    const nextErrors = validateEVisaFields(fields, passportId);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setFormError(null);
    setBusy(true);

    const result = existing
      ? await supabase
          .from("e_visas")
          .update(evisaUpdatePayload(passportId, fields))
          .eq("id", existing.id)
      : await supabase
          .from("e_visas")
          .insert(evisaPayload(visa.org_id, visa.id, passportId, fields));

    setBusy(false);
    if (result.error) {
      setFormError(friendlyEvisaConflict(result.error.message));
      return;
    }
    navigate(`/visas/${id}`, {
      state: {
        flashSuccess: existing ? "e-Visa updated." : "e-Visa saved.",
      },
    });
  }

  if (!id) return null;

  if (loading) {
    return <p className="text-muted">Loading…</p>;
  }

  if (!visa) {
    return (
      <div className="space-y-2">
        <p className="text-red-700">{formError ?? "Visa not found."}</p>
        <Link to="/visas/active" className="link-brand text-sm">
          ← Back to list
        </Link>
      </div>
    );
  }

  const title = existing ? "Edit e-visa" : "Add e-visa";

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/visas/${id}`} className="link-brand text-sm">
          ← Back
        </Link>
        <h1 className="page-title mt-2">{title}</h1>
        {customer ? (
          <p className="mt-1 text-sm text-muted">{customer.full_name}</p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="panel space-y-5 p-5 sm:p-6">
        <FormSection>
          <SectionHeading
            step={1}
            title="Passport"
            hint="Linked to this customer’s travel document. Number and expiry fill in from the booklet you pick."
          />
          <PassportSelect
            passports={customer?.passports ?? []}
            passportId={passportId}
            onChange={onPassportChange}
            error={errors.passportId}
          />
        </FormSection>

        <FormSection>
          <SectionHeading step={2} title="Document details" />
          <EVisaFields
            value={fields}
            onChange={patchFields}
            errors={errors}
          />
        </FormSection>

        {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Link to={`/visas/${id}`} className="btn-ghost">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy || !customer}
            className="btn-primary"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  PersonFields,
  type PersonFieldErrors,
  type PersonFieldsValue,
} from "../components/forms/PersonFields";
import { PersonPicker } from "../components/forms/PersonPicker";
import { SectionHeading, FormSection } from "../components/forms/formStyles";
import {
  VisaFields,
  type VisaFieldErrors,
  type VisaFieldsValue,
} from "../components/forms/VisaFields";
import { VisaStatusFields } from "../components/forms/VisaStatusFields";
import { getDefaultOrgId } from "../lib/org";
import {
  composePhone,
  DEFAULT_DIAL,
  validatePhone,
} from "../lib/phone";
import { supabase } from "../lib/supabase";
import {
  flagsFromVisaStatus,
  friendlyInProgressConflict,
} from "../lib/visa";
import type { Company, CustomerWithCompany, VisaStatus } from "../types";

export type EntryMode = "personAndVisa" | "personOnly" | "visaOnly";

const MODE_OPTIONS: { id: EntryMode; label: string; hint: string }[] = [
  {
    id: "personAndVisa",
    label: "Customer & visa",
    hint: "New customer with their first visa",
  },
  {
    id: "personOnly",
    label: "Customer only",
    hint: "Register a customer without a visa yet",
  },
  {
    id: "visaOnly",
    label: "Visa only",
    hint: "Add a visa for an existing customer",
  },
];

const emptyPerson = (): PersonFieldsValue => ({
  fullName: "",
  companyId: "",
  passportNumber: "",
  passportExpiry: "",
  visaCount: 0,
  extensionCount: 0,
  dialCode: DEFAULT_DIAL.code,
  localNumber: "",
});

const emptyVisa = (): VisaFieldsValue => ({
  visaDays: "90 Days",
  dateEntered: "",
  dateExtended: "",
  extensionDone: false,
  masukDari: "",
});

type FieldErrors = {
  person?: PersonFieldErrors;
  visa?: VisaFieldErrors;
  customerId?: string;
  form?: string;
};

type EntryFormProps = {
  defaultMode: EntryMode;
};

export function EntryForm({ defaultMode }: EntryFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<EntryMode>(defaultMode);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [customers, setCustomers] = useState<CustomerWithCompany[]>([]);
  const [person, setPerson] = useState<PersonFieldsValue>(emptyPerson);
  const [visa, setVisa] = useState<VisaFieldsValue>(emptyVisa);
  const [existingCustomerId, setExistingCustomerId] = useState("");
  const [visaState, setVisaState] = useState<VisaStatus>("In-Progress");
  const [markAsOpen, setMarkAsOpen] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const { orgId: defaultOrgId, error: orgErr } = await getDefaultOrgId();
      if (cancelled) return;
      if (orgErr || !defaultOrgId) {
        setLoadError(orgErr ?? "No organization found.");
        setLoading(false);
        return;
      }
      setOrgId(defaultOrgId);

      const [{ data: cos, error: cErr }, { data: custRows, error: custErr }] =
        await Promise.all([
          supabase.from("companies").select("*").order("name", { ascending: true }),
          supabase
            .from("customers")
            .select("*, companies ( id, name )")
            .order("full_name", { ascending: true }),
        ]);

      if (cancelled) return;
      if (cErr) {
        setLoadError(cErr.message);
        setLoading(false);
        return;
      }
      if (custErr) {
        setLoadError(custErr.message);
        setLoading(false);
        return;
      }

      setCompanies((cos ?? []) as Company[]);
      setCustomers((custRows ?? []) as CustomerWithCompany[]);

      const preselect = searchParams.get("customer") ?? "";
      if (preselect) setExistingCustomerId(preselect);

      setVisaState("In-Progress");
      setMarkAsOpen(false);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  function patchPerson(patch: Partial<PersonFieldsValue>) {
    setPerson((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => ({
      ...prev,
      person: prev.person
        ? Object.fromEntries(
            Object.entries(prev.person).filter(([k]) => !(k in patch))
          )
        : undefined,
      form: undefined,
    }));
  }

  function patchVisa(patch: Partial<VisaFieldsValue>) {
    setVisa((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => ({
      ...prev,
      visa: prev.visa
        ? Object.fromEntries(
            Object.entries(prev.visa).filter(([k]) => !(k in patch))
          )
        : undefined,
      form: undefined,
    }));
  }

  function onVisaStateChange(next: VisaStatus) {
    setVisaState(next);
    if (next !== "In-Progress") setMarkAsOpen(true);
  }

  function backHref(): string {
    if (defaultMode === "visaOnly") return "/visas/active";
    return "/customers";
  }

  function modeHint(): string {
    return MODE_OPTIONS.find((o) => o.id === mode)?.hint ?? "";
  }

  function submitLabel(): string {
    switch (mode) {
      case "personAndVisa":
        return "Create customer & visa";
      case "personOnly":
        return "Create customer";
      case "visaOnly":
        return "Create visa";
    }
  }

  function personDirty(): boolean {
    const blank = emptyPerson();
    return (
      person.fullName.trim() !== blank.fullName ||
      person.companyId !== blank.companyId ||
      person.passportNumber.trim() !== blank.passportNumber ||
      person.passportExpiry !== blank.passportExpiry ||
      person.localNumber.trim() !== blank.localNumber ||
      person.visaCount !== blank.visaCount ||
      person.extensionCount !== blank.extensionCount
    );
  }

  function visaDirty(): boolean {
    const blank = emptyVisa();
    return (
      visa.dateEntered !== blank.dateEntered ||
      visa.dateExtended !== blank.dateExtended ||
      visa.extensionDone !== blank.extensionDone ||
      visa.masukDari.trim() !== blank.masukDari ||
      visa.visaDays !== blank.visaDays ||
      visaState !== "In-Progress"
    );
  }

  function requestModeChange(next: EntryMode) {
    if (next === mode) return;

    const losingPerson =
      (mode === "personAndVisa" || mode === "personOnly") &&
      next === "visaOnly" &&
      personDirty();
    const losingVisa =
      (mode === "personAndVisa" || mode === "visaOnly") &&
      next === "personOnly" &&
      visaDirty();
    const losingPicker =
      mode === "visaOnly" &&
      next !== "visaOnly" &&
      Boolean(existingCustomerId);

    if (losingPerson || losingVisa || losingPicker) {
      const ok = window.confirm(
        "Switching modes will hide some fields you already filled. Continue?"
      );
      if (!ok) return;
    }
    setMode(next);
    setErrors({});
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    const personErrs: PersonFieldErrors = {};
    const visaErrs: VisaFieldErrors = {};

    if (mode === "personAndVisa" || mode === "personOnly") {
      if (!person.fullName.trim()) personErrs.fullName = "Name is required.";
      if (!person.companyId) personErrs.companyId = "Company is required.";
      if (!person.passportNumber.trim()) {
        personErrs.passportNumber = "Passport number is required.";
      }
      if (!person.passportExpiry) {
        personErrs.passportExpiry = "Passport expiry is required.";
      }
      const phoneErr = validatePhone(person.dialCode, person.localNumber);
      if (phoneErr) personErrs.localNumber = phoneErr;
      if (Object.keys(personErrs).length) next.person = personErrs;
    }

    if (mode === "visaOnly") {
      if (!existingCustomerId) {
        next.customerId = "Select a customer.";
      }
    }

    if (mode === "personAndVisa" || mode === "visaOnly") {
      if (!visa.dateEntered) {
        visaErrs.dateEntered = "Date entered is required.";
      }
      if (Object.keys(visaErrs).length) next.visa = visaErrs;
    }

    setErrors(next);
    return (
      !next.person &&
      !next.visa &&
      !next.customerId
    );
  }

  function blockedCallout(): ReactNode {
    if (mode === "personAndVisa" || mode === "personOnly") {
      if (companies.length > 0) return null;
      return (
        <div className="callout-warn">
          <p className="font-medium">Add a company first</p>
          <p className="mt-1 opacity-80">
            Customers must belong to a company before you can create them.
          </p>
          <Link
            to="/companies"
            className="link-brand mt-2 inline-block"
          >
            Go to companies →
          </Link>
        </div>
      );
    }
    if (customers.length > 0) return null;
    return (
      <div className="callout-warn">
        <p className="font-medium">Add a customer first</p>
        <p className="mt-1 opacity-80">
          Visa only needs an existing customer to attach the visa to.
        </p>
        <button
          type="button"
          onClick={() => requestModeChange("personAndVisa")}
          className="link-brand mt-2"
        >
          Create customer & visa instead →
        </button>
      </div>
    );
  }

  const isBlocked =
    ((mode === "personAndVisa" || mode === "personOnly") &&
      companies.length === 0) ||
    (mode === "visaOnly" && customers.length === 0);

  function submitDisabled(): boolean {
    return busy || !orgId || isBlocked;
  }

  async function insertPerson(org: string): Promise<string | null> {
    const payload = {
      full_name: person.fullName.trim(),
      passport_number: person.passportNumber.trim(),
      passport_expiry: person.passportExpiry,
      visa_count: Math.max(0, Math.floor(Number(person.visaCount)) || 0),
      extension_count: Math.max(0, Math.floor(Number(person.extensionCount)) || 0),
      contact_number: composePhone(person.dialCode, person.localNumber),
      company_id: person.companyId,
    };

    const { data, error: iErr } = await supabase
      .from("customers")
      .insert({ org_id: org, ...payload })
      .select("id")
      .single();

    if (iErr || !data) {
      setErrors({ form: iErr?.message ?? "Could not create customer." });
      return null;
    }
    return (data as { id: string }).id;
  }

  async function insertVisa(
    org: string,
    customerId: string,
    state: VisaStatus
  ): Promise<{ id: string } | { error: string }> {
    const flags = flagsFromVisaStatus(state);
    const { data, error: vErr } = await supabase
      .from("visas")
      .insert({
        org_id: org,
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
      .select("id")
      .single();

    if (vErr || !data) {
      return {
        error: friendlyInProgressConflict(
          vErr?.message ?? "Could not create visa."
        ),
      };
    }
    return { id: (data as { id: string }).id };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId || isBlocked) return;
    if (!validate()) return;

    setErrors({});
    setBusy(true);

    if (mode === "personOnly") {
      const customerId = await insertPerson(orgId);
      setBusy(false);
      if (!customerId) return;
      navigate(`/customers/${customerId}`, {
        state: { flashSuccess: "Customer created." },
      });
      return;
    }

    if (mode === "personAndVisa") {
      const customerId = await insertPerson(orgId);
      if (!customerId) {
        setBusy(false);
        return;
      }

      const result = await insertVisa(orgId, customerId, "In-Progress");
      setBusy(false);
      if ("error" in result) {
        navigate(`/customers/${customerId}`, {
          state: {
            flashError: `Customer was created, but visa failed: ${result.error}`,
          },
        });
        return;
      }
      navigate(`/customers/${customerId}`, {
        state: { flashSuccess: "Customer and visa created." },
      });
      return;
    }

    const result = await insertVisa(orgId, existingCustomerId, visaState);
    setBusy(false);
    if ("error" in result) {
      setErrors({ form: result.error });
      return;
    }
    navigate(`/visas/${result.id}`, {
      state: { flashSuccess: "Visa created." },
    });
  }

  if (loading) {
    return <EntryFormSkeleton />;
  }

  if (loadError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-700">{loadError}</p>
        <Link to={backHref()} className="link-brand text-sm">
          ← Back
        </Link>
      </div>
    );
  }

  const showPerson = mode === "personAndVisa" || mode === "personOnly";
  const showVisa = mode === "personAndVisa" || mode === "visaOnly";
  const showPicker = mode === "visaOnly";
  const showStatus = mode === "visaOnly";
  const customerStep = 1;
  const visaStep = showPerson || showPicker ? 2 : 1;

  return (
    <div className="space-y-6 pb-28">
      <div>
        <Link
          to={backHref()}
          className="link-brand text-sm"
        >
          ← Back
        </Link>
        <h1 className="page-title mt-2">New entry</h1>
        <p className="page-sub mt-1">
          Create a customer, a visa, or both.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="panel space-y-6 p-5 sm:p-6"
      >
        <div>
          <span className="text-sm font-medium text-ink-soft">What to create</span>
          <div
            role="radiogroup"
            aria-label="Create mode"
            className="mt-1 flex flex-col gap-1 rounded-lg border border-line bg-paper p-1 sm:flex-row"
          >
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => requestModeChange(opt.id)}
                  className={`flex-1 rounded-md px-2 py-2.5 text-center text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                    active
                      ? "bg-surface text-brand-ink shadow-sm"
                      : "text-muted hover:bg-surface hover:text-ink"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted">{modeHint()}</p>
        </div>

        {blockedCallout()}

        {!isBlocked ? (
          <>
            {showPerson ? (
              <FormSection>
                <SectionHeading step={customerStep} title="Customer" />
                <PersonFields
                  value={person}
                  companies={companies}
                  onChange={patchPerson}
                  errors={errors.person}
                />
              </FormSection>
            ) : null}

            {showPicker ? (
              <FormSection>
                <SectionHeading step={customerStep} title="Customer" />
                <PersonPicker
                  customers={customers}
                  customerId={existingCustomerId}
                  onCustomerIdChange={(id) => {
                    setExistingCustomerId(id);
                    setErrors((prev) => ({ ...prev, customerId: undefined }));
                  }}
                  emptyHintHref="/customers/new"
                  error={errors.customerId}
                />
              </FormSection>
            ) : null}

            {showVisa ? (
              <FormSection>
                <SectionHeading
                  step={visaStep}
                  title="Visa"
                  hint={
                    mode === "personAndVisa" ? (
                      <>
                        Starts as{" "}
                        <span className="font-medium text-ink">
                          In-Progress
                        </span>{" "}
                        (Active list).
                      </>
                    ) : undefined
                  }
                />
                <VisaFields
                  value={visa}
                  onChange={patchVisa}
                  required
                  errors={errors.visa}
                  defaultMoreOpen={showStatus && (markAsOpen || visaState !== "In-Progress")}
                  moreDetailsExtra={
                    showStatus ? (
                      <VisaStatusFields
                        visaState={visaState}
                        onVisaStateChange={onVisaStateChange}
                        isEdit={false}
                        markAsOpen={markAsOpen}
                        onMarkAsOpenChange={setMarkAsOpen}
                      />
                    ) : null
                  }
                />
              </FormSection>
            ) : null}
          </>
        ) : null}

        {errors.form ? (
          <p className="text-sm text-red-700">{errors.form}</p>
        ) : null}

        <div className="fixed inset-x-0 bottom-[calc(2.75rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 py-3 backdrop-blur md:sticky md:inset-x-auto md:bottom-0 md:-mx-6 md:border-line md:px-6">
          <div className="mx-auto flex max-w-7xl flex-col-reverse gap-2 px-4 sm:flex-row sm:justify-end md:px-0">
            <Link
              to={backHref()}
              className="btn-ghost"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitDisabled()}
              className="btn-primary"
            >
              {busy ? "Saving…" : submitLabel()}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function EntryFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-4 w-16 rounded bg-line" />
        <div className="mt-3 h-8 w-40 rounded bg-line" />
        <div className="mt-2 h-4 w-64 rounded bg-ok-soft" />
      </div>
      <div className="panel space-y-4 p-5 sm:p-6">
        <div className="h-10 rounded-lg bg-ok-soft" />
        <div className="h-4 w-48 rounded bg-ok-soft" />
        <div className="space-y-3 border-t border-line pt-5">
          <div className="h-5 w-28 rounded bg-line" />
          <div className="h-10 rounded-lg bg-ok-soft" />
          <div className="h-10 rounded-lg bg-ok-soft" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-10 rounded-lg bg-ok-soft" />
            <div className="h-10 rounded-lg bg-ok-soft" />
          </div>
        </div>
      </div>
    </div>
  );
}

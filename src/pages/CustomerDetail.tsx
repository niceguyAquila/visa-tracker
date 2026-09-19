import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CompanyChip } from "../components/CompanyChip";
import {
  FieldError,
  FieldLabel,
  inputClass,
  inputErrorClass,
} from "../components/forms/formStyles";
import {
  currentPassport,
  CUSTOMER_LIST_SELECT,
  friendlyPassportConflict,
  sortPassports,
} from "../lib/customer";
import { supabase } from "../lib/supabase";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import { statusBadgeClass, urgencyClass } from "../lib/ui";
import type { CustomerWithCompany, Passport, Visa } from "../types";

type PassportDraft = {
  passportNumber: string;
  passportExpiry: string;
  isCurrent: boolean;
};

const emptyDraft = (): PassportDraft => ({
  passportNumber: "",
  passportExpiry: "",
  isCurrent: true,
});

export function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [customer, setCustomer] = useState<CustomerWithCompany | null>(null);
  const [visas, setVisas] = useState<Visa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashError, setFlashError] = useState<string | null>(null);
  const [flashSuccess, setFlashSuccess] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<PassportDraft>(emptyDraft);
  const [draftErrors, setDraftErrors] = useState<{
    passportNumber?: string;
    passportExpiry?: string;
  }>({});
  const [passportBusy, setPassportBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PassportDraft>(emptyDraft);

  useEffect(() => {
    const state = location.state as {
      flashError?: string;
      flashSuccess?: string;
    } | null;
    if (state?.flashError || state?.flashSuccess) {
      if (state.flashError) setFlashError(state.flashError);
      if (state.flashSuccess) setFlashSuccess(state.flashSuccess);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("customers")
      .select(CUSTOMER_LIST_SELECT)
      .eq("id", id)
      .single();
    if (qErr || !data) {
      setError(qErr?.message ?? "Not found");
      setCustomer(null);
      setVisas([]);
      setLoading(false);
      return;
    }
    const row = data as CustomerWithCompany;
    setCustomer({
      ...row,
      passports: row.passports ?? [],
    });

    const { data: visaRows, error: vErr } = await supabase
      .from("visas")
      .select("*")
      .eq("customer_id", id)
      .order("date_entered", { ascending: false });
    if (vErr) {
      setError(vErr.message);
      setVisas([]);
    } else {
      setVisas((visaRows ?? []) as Visa[]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeCustomer() {
    if (!id) return;
    if (!confirm("Delete this customer?")) return;
    const { error: dErr } = await supabase.from("customers").delete().eq("id", id);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    navigate("/customers");
  }

  function validateDraft(value: PassportDraft): {
    passportNumber?: string;
    passportExpiry?: string;
  } {
    const next: { passportNumber?: string; passportExpiry?: string } = {};
    if (!value.passportNumber.trim()) {
      next.passportNumber = "Passport number is required.";
    }
    if (!value.passportExpiry) {
      next.passportExpiry = "Passport expiry is required.";
    }
    return next;
  }

  async function addPassport(e: FormEvent) {
    e.preventDefault();
    if (!customer) return;
    const errs = validateDraft(draft);
    setDraftErrors(errs);
    if (Object.keys(errs).length) return;

    setPassportBusy(true);
    setError(null);
    const { error: iErr } = await supabase.from("passports").insert({
      org_id: customer.org_id,
      customer_id: customer.id,
      passport_number: draft.passportNumber.trim(),
      passport_expiry: draft.passportExpiry,
      is_current: draft.isCurrent,
    });
    setPassportBusy(false);
    if (iErr) {
      setError(friendlyPassportConflict(iErr.message));
      return;
    }
    setDraft(emptyDraft());
    setAdding(false);
    setFlashSuccess("Passport added.");
    await load();
  }

  async function savePassport(passport: Passport) {
    const errs = validateDraft(editDraft);
    if (Object.keys(errs).length) {
      setError(Object.values(errs)[0] ?? "Passport is invalid.");
      return;
    }
    setPassportBusy(true);
    setError(null);
    const { error: uErr } = await supabase
      .from("passports")
      .update({
        passport_number: editDraft.passportNumber.trim(),
        passport_expiry: editDraft.passportExpiry,
      })
      .eq("id", passport.id);
    setPassportBusy(false);
    if (uErr) {
      setError(friendlyPassportConflict(uErr.message));
      return;
    }
    setEditingId(null);
    setFlashSuccess("Passport updated.");
    await load();
  }

  async function setCurrentPassport(passport: Passport) {
    if (passport.is_current) return;
    setPassportBusy(true);
    setError(null);
    const { error: uErr } = await supabase
      .from("passports")
      .update({ is_current: true })
      .eq("id", passport.id);
    setPassportBusy(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setFlashSuccess("Current passport updated.");
    await load();
  }

  async function removePassport(passport: Passport) {
    if (!customer) return;
    if ((customer.passports ?? []).length <= 1) {
      setError("A customer must keep at least one passport.");
      return;
    }
    if (!confirm(`Delete passport ${passport.passport_number}?`)) return;
    setPassportBusy(true);
    setError(null);
    const { error: dErr } = await supabase
      .from("passports")
      .delete()
      .eq("id", passport.id);
    setPassportBusy(false);
    if (dErr) {
      setError(
        /restrict|foreign key|passport_id/i.test(dErr.message)
          ? "This passport is used on a visa, so it cannot be deleted."
          : dErr.message
      );
      return;
    }
    if (passport.is_current) {
      const remaining = (customer.passports ?? []).filter(
        (p) => p.id !== passport.id
      );
      const nextCurrent = remaining[0];
      if (nextCurrent) {
        await supabase
          .from("passports")
          .update({ is_current: true })
          .eq("id", nextCurrent.id);
      }
    }
    setFlashSuccess("Passport deleted.");
    await load();
  }

  if (!id) return null;

  if (loading) {
    return <p className="text-muted">Loading…</p>;
  }

  if (!customer) {
    return (
      <div className="space-y-2">
        <p className="text-red-700">{error ?? "Not found"}</p>
        <Link to="/customers" className="link-brand text-sm">
          ← Back to list
        </Link>
      </div>
    );
  }

  const passports = sortPassports(customer.passports ?? []);
  const current = currentPassport(passports);
  const days = current ? daysUntilISODate(current.passport_expiry) : null;

  return (
    <div className="space-y-6">
      {flashSuccess ? (
        <p className="flash-success">
          {flashSuccess}
        </p>
      ) : null}
      {flashError ? (
        <p className="flash-error">
          {flashError}
        </p>
      ) : null}
      <div>
        <Link to="/customers" className="link-brand text-sm">
          ← Customers
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="page-title">{customer.full_name}</h1>
            <div className="mt-1">
              {customer.companies ? (
                <CompanyChip
                  name={customer.companies.name}
                  color={customer.companies.color}
                />
              ) : (
                <p className="text-muted">—</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/customers/${id}/edit`}
              className="btn-ghost"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={() => void removeCustomer()}
              className="btn-danger"
            >
              Delete customer
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="panel p-4">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="meta">
              Current passport
            </dt>
            <dd className="mt-1 font-mono text-ink">
              {current?.passport_number ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="meta">
              Passport expiry
            </dt>
            <dd className="mt-1">
              {current && days !== null ? (
                <span
                  className={`inline-flex flex-col rounded-lg px-3 py-2 text-sm ${urgencyClass(days)}`}
                >
                  <span className="font-medium">{formatDisplayDate(current.passport_expiry)}</span>
                  <span className="text-xs opacity-90">
                    {days < 0
                      ? `Expired ${Math.abs(days)}d ago`
                      : days === 0
                        ? "Expires today (UTC)"
                        : `${days}d until expiry (UTC)`}
                  </span>
                </span>
              ) : (
                <span className="text-ink">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="meta">
              Visa count
            </dt>
            <dd className="mt-1 text-ink">{customer.visa_count}</dd>
          </div>
          <div>
            <dt className="meta">
              Extension count
            </dt>
            <dd className="mt-1 text-ink">{customer.extension_count}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="meta">
              Contact number
            </dt>
            <dd className="mt-1 text-ink">{customer.contact_number || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">Passports</h2>
          {!adding ? (
            <button
              type="button"
              onClick={() => {
                setDraft(emptyDraft());
                setDraftErrors({});
                setAdding(true);
              }}
              className="btn-ghost sm:w-auto"
            >
              Add passport
            </button>
          ) : null}
        </div>

        {adding ? (
          <form
            onSubmit={(e) => void addPassport(e)}
            className="panel space-y-4 p-4"
          >
            <p className="text-sm font-medium text-ink">New passport</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel required>Passport number</FieldLabel>
                <input
                  value={draft.passportNumber}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, passportNumber: e.target.value }))
                  }
                  className={
                    draftErrors.passportNumber ? inputErrorClass : inputClass
                  }
                />
                <FieldError message={draftErrors.passportNumber} />
              </label>
              <label className="block">
                <FieldLabel required>Passport expiry</FieldLabel>
                <input
                  type="date"
                  value={draft.passportExpiry}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, passportExpiry: e.target.value }))
                  }
                  className={
                    draftErrors.passportExpiry ? inputErrorClass : inputClass
                  }
                />
                <FieldError message={draftErrors.passportExpiry} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.isCurrent}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, isCurrent: e.target.checked }))
                }
              />
              Set as current passport
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setAdding(false);
                  setDraftErrors({});
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={passportBusy}
                className="btn-primary"
              >
                {passportBusy ? "Saving…" : "Save passport"}
              </button>
            </div>
          </form>
        ) : null}

        {passports.length === 0 ? (
          <div className="empty-state p-6">
            No passports recorded yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {passports.map((p) => {
              const pDays = daysUntilISODate(p.passport_expiry);
              const editing = editingId === p.id;
              return (
                <li key={p.id} className="panel space-y-3 p-4">
                  {editing ? (
                    <div className="space-y-3">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <FieldLabel required>Passport number</FieldLabel>
                          <input
                            value={editDraft.passportNumber}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...prev,
                                passportNumber: e.target.value,
                              }))
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className="block">
                          <FieldLabel required>Passport expiry</FieldLabel>
                          <input
                            type="date"
                            value={editDraft.passportExpiry}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...prev,
                                passportExpiry: e.target.value,
                              }))
                            }
                            className={inputClass}
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={passportBusy}
                          onClick={() => void savePassport(p)}
                          className="btn-primary"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="btn-ghost"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-medium text-ink">
                            {p.passport_number}
                          </p>
                          {p.is_current ? (
                            <span className="inline-flex rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-ink">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <p
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs ${urgencyClass(pDays)}`}
                        >
                          Expires {formatDisplayDate(p.passport_expiry)}
                          {pDays < 0
                            ? ` · expired ${Math.abs(pDays)}d ago`
                            : pDays === 0
                              ? " · expires today"
                              : ` · ${pDays}d left`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!p.is_current ? (
                          <button
                            type="button"
                            disabled={passportBusy}
                            onClick={() => void setCurrentPassport(p)}
                            className="btn-ghost px-3 py-1.5"
                          >
                            Set current
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(p.id);
                            setEditDraft({
                              passportNumber: p.passport_number,
                              passportExpiry: p.passport_expiry,
                              isCurrent: p.is_current,
                            });
                          }}
                          className="btn-ghost px-3 py-1.5"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={passportBusy || passports.length <= 1}
                          onClick={() => void removePassport(p)}
                          className="btn-danger px-3 py-1.5 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">Visas</h2>
          {visas.some((v) => v.status === "In-Progress") ? (
            <p className="text-sm text-muted">
              An In-Progress visa already exists for this customer.
            </p>
          ) : (
            <Link
              to={`/visas/new?customer=${id}`}
              className="btn-primary sm:w-auto"
            >
              Add visa
            </Link>
          )}
        </div>

        {visas.length === 0 ? (
          <div className="empty-state p-6">
            No visas for this customer yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {visas.map((v) => (
              <li key={v.id}>
                <Link
                  to={`/visas/${v.id}`}
                  className="list-card"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-ink">{v.visa_days}</p>
                      <p className="text-sm text-muted">
                        Entered {formatDisplayDate(v.date_entered)} · Extension{" "}
                        {formatDisplayDate(v.date_to_extension)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-md px-2.5 py-1 text-xs font-medium ${statusBadgeClass(v.status)}`}
                    >
                      {v.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

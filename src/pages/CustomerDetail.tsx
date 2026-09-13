import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CompanyChip } from "../components/CompanyChip";
import { supabase } from "../lib/supabase";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import { statusBadgeClass, urgencyClass } from "../lib/ui";
import type { CustomerWithCompany, Visa } from "../types";

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
      .select("*, companies ( id, name, color )")
      .eq("id", id)
      .single();
    if (qErr || !data) {
      setError(qErr?.message ?? "Not found");
      setCustomer(null);
      setVisas([]);
      setLoading(false);
      return;
    }
    setCustomer(data as CustomerWithCompany);

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

  const days = daysUntilISODate(customer.passport_expiry);

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
              Passport number
            </dt>
            <dd className="mt-1 text-ink">{customer.passport_number}</dd>
          </div>
          <div>
            <dt className="meta">
              Passport expiry
            </dt>
            <dd className="mt-1">
              <span
                className={`inline-flex flex-col rounded-lg px-3 py-2 text-sm ${urgencyClass(days)}`}
              >
                <span className="font-medium">{formatDisplayDate(customer.passport_expiry)}</span>
                <span className="text-xs opacity-90">
                  {days < 0
                    ? `Expired ${Math.abs(days)}d ago`
                    : days === 0
                      ? "Expires today (UTC)"
                      : `${days}d until expiry (UTC)`}
                </span>
              </span>
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

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import type { CustomerWithCompany, Visa, VisaStatus } from "../types";

function urgencyClass(days: number): string {
  if (days < 0) return "bg-red-100 text-red-900";
  if (days <= 10) return "bg-amber-100 text-amber-900";
  if (days <= 30) return "bg-yellow-50 text-yellow-900";
  return "bg-slate-100 text-slate-700";
}

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

export function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerWithCompany | null>(null);
  const [visas, setVisas] = useState<Visa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("customers")
      .select("*, companies ( id, name )")
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
    return <p className="text-slate-500">Loading…</p>;
  }

  if (!customer) {
    return (
      <div className="space-y-2">
        <p className="text-red-600">{error ?? "Not found"}</p>
        <Link to="/customers" className="text-sm font-medium text-blue-600 hover:underline">
          ← Back to list
        </Link>
      </div>
    );
  }

  const days = daysUntilISODate(customer.passport_expiry);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/customers" className="text-sm font-medium text-blue-600 hover:underline">
          ← Customers
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{customer.full_name}</h1>
            <p className="text-slate-600">{customer.companies?.name ?? "—"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/customers/${id}/edit`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={() => void removeCustomer()}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Delete customer
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Passport number
            </dt>
            <dd className="mt-1 text-slate-900">{customer.passport_number}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Visa count
            </dt>
            <dd className="mt-1 text-slate-900">{customer.visa_count}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Extension count
            </dt>
            <dd className="mt-1 text-slate-900">{customer.extension_count}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Contact number
            </dt>
            <dd className="mt-1 text-slate-900">{customer.contact_number || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Visas</h2>
          {visas.some((v) => v.status === "In-Progress") ? (
            <p className="text-sm text-slate-500">
              An In-Progress visa already exists for this customer.
            </p>
          ) : (
            <Link
              to={`/visas/new?customer=${id}`}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
            >
              Add visa
            </Link>
          )}
        </div>

        {visas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-600">
            No visas for this customer yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {visas.map((v) => (
              <li key={v.id}>
                <Link
                  to={`/visas/${v.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{v.visa_days}</p>
                      <p className="text-sm text-slate-500">
                        Entered {formatDisplayDate(v.date_entered)} · Extension{" "}
                        {formatDisplayDate(v.date_to_extension)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-lg px-2.5 py-1 text-xs font-medium ${statusBadgeClass(v.status)}`}
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

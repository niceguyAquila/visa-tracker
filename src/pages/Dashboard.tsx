import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import {
  aggregateKpis,
  customersForCompany,
  metricsByCompany,
  type Kpis,
} from "../lib/metrics";
import { supabase } from "../lib/supabase";
import type { Company, CustomerWithCompany } from "../types";

function parseISODateNum(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function urgencyClass(days: number): string {
  if (days < 0) return "bg-red-100 text-red-900";
  if (days <= 10) return "bg-amber-100 text-amber-900";
  if (days <= 30) return "bg-yellow-50 text-yellow-900";
  return "bg-slate-100 text-slate-700";
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "red" | "amber" | "yellow";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : tone === "yellow"
          ? "border-yellow-200 bg-yellow-50"
          : "border-slate-200 bg-white";

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function KpiGrid({ kpis, showCompanies }: { kpis: Kpis; showCompanies: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <KpiCard label="Customers" value={kpis.customers} />
      {showCompanies ? <KpiCard label="Companies" value={kpis.companies} /> : null}
      <KpiCard label="Passports expired" value={kpis.expired} tone="red" />
      <KpiCard label="Expiring ≤10d" value={kpis.expiring10} tone="amber" />
      <KpiCard label="Expiring ≤30d" value={kpis.expiring30} tone="yellow" />
      <KpiCard label="Total visas" value={kpis.visas} />
      <KpiCard label="Total extensions" value={kpis.extensions} />
    </div>
  );
}

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const companyParam = searchParams.get("company");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [customers, setCustomers] = useState<CustomerWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [coRes, cuRes] = await Promise.all([
      supabase.from("companies").select("*").order("name", { ascending: true }),
      supabase
        .from("customers")
        .select("*, companies ( id, name )")
        .order("full_name", { ascending: true }),
    ]);

    if (coRes.error) {
      setError(coRes.error.message);
      setCompanies([]);
      setCustomers([]);
      setLoading(false);
      return;
    }
    if (cuRes.error) {
      setError(cuRes.error.message);
      setCompanies((coRes.data ?? []) as Company[]);
      setCustomers([]);
      setLoading(false);
      return;
    }

    setCompanies((coRes.data ?? []) as Company[]);
    setCustomers((cuRes.data ?? []) as CustomerWithCompany[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const focusedCompany = useMemo(
    () => companies.find((c) => c.id === companyParam) ?? null,
    [companies, companyParam]
  );
  const focusedId = focusedCompany?.id ?? null;

  const scopedCustomers = useMemo(
    () => customersForCompany(customers, focusedId),
    [customers, focusedId]
  );

  const kpis = useMemo(
    () => aggregateKpis(scopedCustomers, focusedId ? 1 : companies.length),
    [scopedCustomers, focusedId, companies.length]
  );

  const companyRows = useMemo(
    () => metricsByCompany(companies, customers),
    [companies, customers]
  );

  const sortedFocused = useMemo(() => {
    return [...scopedCustomers].sort(
      (a, b) => parseISODateNum(a.passport_expiry) - parseISODateNum(b.passport_expiry)
    );
  }, [scopedCustomers]);

  function setFocusedCompany(id: string | null) {
    if (id) setSearchParams({ company: id });
    else setSearchParams({});
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            {focusedCompany
              ? `Metrics for ${focusedCompany.name}`
              : "Metrics across all companies."}
          </p>
        </div>
        {companies.length > 0 ? (
          <label className="block text-sm sm:min-w-56">
            <span className="mb-1 block font-medium text-slate-600">Company</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={focusedId ?? ""}
              onChange={(e) => setFocusedCompany(e.target.value || null)}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
          No companies yet.{" "}
          <Link to="/companies" className="font-medium text-blue-600 hover:underline">
            Add a company
          </Link>{" "}
          to start tracking metrics.
        </div>
      ) : (
        <>
          <KpiGrid kpis={kpis} showCompanies={!focusedCompany} />

          {focusedCompany ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Customers at {focusedCompany.name}
                </h2>
                <button
                  type="button"
                  onClick={() => setFocusedCompany(null)}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  All companies
                </button>
              </div>
              {sortedFocused.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
                  No customers at this company yet.{" "}
                  <Link
                    to="/customers/new"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Add a customer
                  </Link>
                  .
                </div>
              ) : (
                <ul className="space-y-3">
                  {sortedFocused.map((c) => {
                    const d = daysUntilISODate(c.passport_expiry);
                    return (
                      <li key={c.id}>
                        <Link
                          to={`/customers/${c.id}`}
                          className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-medium text-slate-900">{c.full_name}</p>
                            <div
                              className={`inline-flex flex-col rounded-lg px-3 py-2 text-sm sm:items-end ${urgencyClass(d)}`}
                            >
                              <span className="font-medium">
                                Passport · {formatDisplayDate(c.passport_expiry)}
                              </span>
                              <span className="text-xs opacity-90">
                                {d < 0
                                  ? `Expired ${Math.abs(d)}d ago`
                                  : d === 0
                                    ? "Expires today (UTC)"
                                    : `${d}d until expiry (UTC)`}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">By company</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Company</th>
                      <th className="px-3 py-2.5 text-right">Customers</th>
                      <th className="px-3 py-2.5 text-right">Expired</th>
                      <th className="px-3 py-2.5 text-right">≤10d</th>
                      <th className="px-3 py-2.5 text-right">≤30d</th>
                      <th className="px-3 py-2.5 text-right">Visas</th>
                      <th className="px-3 py-2.5 text-right">Ext.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyRows.map((row) => (
                      <tr
                        key={row.companyId}
                        className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                        tabIndex={0}
                        role="button"
                        onClick={() => setFocusedCompany(row.companyId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setFocusedCompany(row.companyId);
                          }
                        }}
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {row.name}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {row.customers}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {row.expired}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {row.expiring10}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {row.expiring30}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {row.visas}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {row.extensions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                Select a company above or click a row to focus its metrics.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

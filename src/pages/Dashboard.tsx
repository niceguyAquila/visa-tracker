import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CompanySwatch } from "../components/CompanyChip";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import {
  aggregateKpis,
  customersForCompany,
  metricsByCompany,
  type Kpis,
} from "../lib/metrics";
import { supabase } from "../lib/supabase";
import { kpiToneClass, urgencyClass } from "../lib/ui";
import type { Company, CustomerWithCompany } from "../types";

function parseISODateNum(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function KpiCard({
  label,
  value,
  tone,
  to,
}: {
  label: string;
  value: number;
  tone?: "red" | "amber" | "yellow";
  to?: string;
}) {
  const className = `rounded-lg border px-4 py-3 ${kpiToneClass(tone)}${
    to ? " block transition hover:border-line-strong" : ""
  }`;

  const body = (
    <>
      <p className="meta">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

function kpiPath(
  pathname: string,
  params: Record<string, string | null | undefined>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function KpiGrid({
  kpis,
  showCompanies,
  companyId,
}: {
  kpis: Kpis;
  showCompanies: boolean;
  companyId: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      <KpiCard
        label="Customers"
        value={kpis.customers}
        to={kpiPath("/customers", { company: companyId })}
      />
      {showCompanies ? <KpiCard label="Companies" value={kpis.companies} /> : null}
      <KpiCard
        label="Passports expired"
        value={kpis.expired}
        tone="red"
        to={kpiPath("/customers", { expiry: "expired", company: companyId })}
      />
      <KpiCard
        label="Expiring ≤10d"
        value={kpis.expiring10}
        tone="amber"
        to={kpiPath("/customers", { expiry: "10", company: companyId })}
      />
      <KpiCard
        label="Expiring ≤30d"
        value={kpis.expiring30}
        tone="yellow"
        to={kpiPath("/customers", { expiry: "30", company: companyId })}
      />
      <KpiCard
        label="Total visas"
        value={kpis.visas}
        to={kpiPath("/visas/active", { company: companyId })}
      />
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
        .select("*, companies ( id, name, color )")
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
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            {focusedCompany
              ? `Metrics for ${focusedCompany.name}`
              : "Metrics across all companies."}
          </p>
        </div>
        {companies.length > 0 ? (
          <label className="block text-sm sm:min-w-56">
            <span className="mb-1 block font-medium text-ink-soft">Company</span>
            <select
              className="input-field text-sm"
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
        <p className="text-muted">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : companies.length === 0 ? (
        <div className="empty-state">
          No companies yet.{" "}
          <Link to="/companies" className="link-brand">
            Add a company
          </Link>{" "}
          to start tracking metrics.
        </div>
      ) : (
        <>
          <KpiGrid
            kpis={kpis}
            showCompanies={!focusedCompany}
            companyId={focusedId}
          />

          {focusedCompany ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                  <CompanySwatch color={focusedCompany.color} className="size-3.5" />
                  Customers at {focusedCompany.name}
                </h2>
                <button
                  type="button"
                  onClick={() => setFocusedCompany(null)}
                  className="link-brand text-sm"
                >
                  All companies
                </button>
              </div>
              {sortedFocused.length === 0 ? (
                <div className="empty-state">
                  No customers at this company yet.{" "}
                  <Link to="/customers/new" className="link-brand">
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
                        <Link to={`/customers/${c.id}`} className="list-card">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-medium text-ink">{c.full_name}</p>
                            <div
                              className={`inline-flex flex-col rounded-lg px-3 py-2 text-sm sm:items-end ${urgencyClass(d)}`}
                            >
                              <span className="meta opacity-80">Passport</span>
                              <span className="font-medium tabular-nums">
                                {formatDisplayDate(c.passport_expiry)}
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
              <h2 className="text-lg font-semibold text-ink">By company</h2>
              <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="border-b border-line bg-paper text-xs font-medium uppercase tracking-wide text-muted">
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
                        className="cursor-pointer border-t border-line/80 hover:bg-paper"
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
                        <td className="px-3 py-2.5 font-medium text-ink">
                          <span className="inline-flex items-center gap-2">
                            <CompanySwatch color={row.color} />
                            {row.name}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                          {row.customers}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                          {row.expired}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                          {row.expiring10}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                          {row.expiring30}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                          {row.visas}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                          {row.extensions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted">
                Select a company above or click a row to focus its metrics.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

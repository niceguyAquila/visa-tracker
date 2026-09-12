import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import type { CustomerWithCompany } from "../types";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

type ExpiryFilter = "all" | "expired" | "10" | "30" | "ok";

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

function parseExpiryFilter(value: string | null): ExpiryFilter {
  if (value === "expired" || value === "10" || value === "30" || value === "ok") {
    return value;
  }
  return "all";
}

function matchesQuery(c: CustomerWithCompany, q: string): boolean {
  if (!q) return true;
  return (
    c.full_name.toLowerCase().includes(q) ||
    c.passport_number.toLowerCase().includes(q) ||
    c.contact_number.toLowerCase().includes(q) ||
    (c.companies?.name ?? "").toLowerCase().includes(q)
  );
}

function matchesExpiry(days: number, filter: ExpiryFilter): boolean {
  switch (filter) {
    case "expired":
      return days < 0;
    case "10":
      return days >= 0 && days <= 10;
    case "30":
      return days >= 0 && days <= 30;
    case "ok":
      return days > 30;
    default:
      return true;
  }
}

export function CustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const companyId = searchParams.get("company") ?? "";
  const expiry = parseExpiryFilter(searchParams.get("expiry"));

  const [rows, setRows] = useState<CustomerWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("customers")
      .select("*, companies ( id, name )")
      .order("full_name", { ascending: true });

    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows((data ?? []) as CustomerWithCompany[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of rows) {
      if (c.companies) map.set(c.companies.id, c.companies.name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtersActive = Boolean(query.trim() || companyId || expiry !== "all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...rows]
      .filter((c) => {
        if (companyId && c.company_id !== companyId) return false;
        if (!matchesQuery(c, q)) return false;
        return matchesExpiry(daysUntilISODate(c.passport_expiry), expiry);
      })
      .sort(
        (a, b) => parseISODateNum(a.passport_expiry) - parseISODateNum(b.passport_expiry)
      );
  }, [rows, query, companyId, expiry]);

  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSearchParams({}, { replace: true });
  }

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
        <p className="text-sm text-slate-600">
          Track passport expiry dates by company.
        </p>
      </div>

      <Link
        to="/customers/new"
        aria-label="Add customer"
        className="fixed z-50 flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-7"
          aria-hidden="true"
          fill="currentColor"
        >
          <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
        </svg>
      </Link>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
          No customers yet.{" "}
          <Link to="/companies" className="font-medium text-blue-600 hover:underline">
            Add a company
          </Link>{" "}
          then create a customer.
        </div>
      ) : (
        <>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">Search</span>
              <input
                type="search"
                className={inputClass}
                placeholder="Name, passport, phone, or company"
                value={query}
                onChange={(e) => updateParams({ q: e.target.value })}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Company</span>
                <select
                  className={inputClass}
                  value={companyId}
                  onChange={(e) => updateParams({ company: e.target.value })}
                >
                  <option value="">All companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Passport expiry
                </span>
                <select
                  className={inputClass}
                  value={expiry}
                  onChange={(e) =>
                    updateParams({
                      expiry: e.target.value === "all" ? "" : e.target.value,
                    })
                  }
                >
                  <option value="all">All</option>
                  <option value="expired">Expired</option>
                  <option value="10">Expiring ≤10 days</option>
                  <option value="30">Expiring ≤30 days</option>
                  <option value="ok">More than 30 days</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
            <p>
              {filtered.length === rows.length
                ? `${rows.length} customer${rows.length === 1 ? "" : "s"}`
                : `${filtered.length} of ${rows.length} customers`}
            </p>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="font-medium text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
              No customers match these filters.{" "}
              <button
                type="button"
                onClick={clearFilters}
                className="font-medium text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((c) => {
                const d = daysUntilISODate(c.passport_expiry);
                return (
                  <li key={c.id}>
                    <Link
                      to={`/customers/${c.id}`}
                      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 font-medium text-slate-900">
                            {c.full_name}
                          </p>
                          <p className="shrink-0 text-right text-sm text-slate-500">
                            {c.companies?.name ?? "—"}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-mono text-sm text-slate-700">
                            {c.passport_number}
                          </p>
                          <div
                            className={`inline-flex flex-col rounded-lg px-3 py-2 text-sm sm:items-end ${urgencyClass(d)}`}
                          >
                            <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                              Passport expiry
                            </span>
                            <span className="font-medium">
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
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

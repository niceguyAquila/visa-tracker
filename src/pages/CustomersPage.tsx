import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AddFab } from "../components/AddFab";
import { CompanyChip } from "../components/CompanyChip";
import {
  currentPassport,
  CUSTOMER_LIST_SELECT,
  unresolvedDuplicateGroups,
} from "../lib/customer";
import { supabase } from "../lib/supabase";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import { urgencyClass } from "../lib/ui";
import type { CustomerWithCompany, DuplicateExclusion } from "../types";

const inputClass = "input-field text-sm";

type ExpiryFilter = "all" | "expired" | "10" | "30" | "ok";

function parseISODateNum(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function parseExpiryFilter(value: string | null): ExpiryFilter {
  if (value === "expired" || value === "10" || value === "30" || value === "ok") {
    return value;
  }
  return "all";
}

function matchesQuery(c: CustomerWithCompany, q: string): boolean {
  if (!q) return true;
  const numbers = (c.passports ?? [])
    .map((p) => p.passport_number.toLowerCase())
    .join(" ");
  return (
    c.full_name.toLowerCase().includes(q) ||
    numbers.includes(q) ||
    c.contact_number.toLowerCase().includes(q) ||
    (c.companies?.name ?? "").toLowerCase().includes(q)
  );
}

function matchesExpiry(days: number | null, filter: ExpiryFilter): boolean {
  if (days === null) return filter === "all";
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
  const [exclusions, setExclusions] = useState<DuplicateExclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data, error: qErr }, { data: exRows, error: exErr }] =
      await Promise.all([
        supabase
          .from("customers")
          .select(CUSTOMER_LIST_SELECT)
          .order("full_name", { ascending: true }),
        supabase.from("duplicate_exclusions").select("*"),
      ]);

    if (qErr) {
      setError(qErr.message);
      setRows([]);
      setExclusions([]);
    } else {
      setRows(
        ((data ?? []) as CustomerWithCompany[]).map((c) => ({
          ...c,
          passports: c.passports ?? [],
        }))
      );
      if (exErr && !/schema cache|does not exist/i.test(exErr.message)) {
        setError(exErr.message);
        setExclusions([]);
      } else {
        setExclusions((exRows ?? []) as DuplicateExclusion[]);
      }
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

  const duplicateCount = useMemo(
    () => unresolvedDuplicateGroups(rows, exclusions).length,
    [rows, exclusions]
  );

  const filtersActive = Boolean(query.trim() || companyId || expiry !== "all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...rows]
      .filter((c) => {
        if (companyId && c.company_id !== companyId) return false;
        if (!matchesQuery(c, q)) return false;
        const current = currentPassport(c.passports);
        const days = current ? daysUntilISODate(current.passport_expiry) : null;
        return matchesExpiry(days, expiry);
      })
      .sort((a, b) => {
        const aP = currentPassport(a.passports);
        const bP = currentPassport(b.passports);
        const aN = aP ? parseISODateNum(aP.passport_expiry) : Number.MAX_SAFE_INTEGER;
        const bN = bP ? parseISODateNum(bP.passport_expiry) : Number.MAX_SAFE_INTEGER;
        return aN - bN;
      });
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
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Customers</h1>
        <p className="page-sub">
          Track passport expiry dates by company.
        </p>
      </div>

      <AddFab
        to="/customers/new"
        label="Add customer"
        storageKey="fab-customers"
      />

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          No customers yet.{" "}
          <Link to="/settings" className="link-brand">
            Add a company
          </Link>{" "}
          then create a customer.
        </div>
      ) : (
        <>
          {duplicateCount > 0 ? (
            <div className="callout-warn">
              <p className="font-medium">
                {duplicateCount} possible duplicate
                {duplicateCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1 opacity-80">
                Same name and company with different passport numbers. Merge
                renewals, or mark different people as distinct.
              </p>
              <Link
                to="/customers/duplicates"
                className="link-brand mt-2 inline-block"
              >
                Review and merge →
              </Link>
            </div>
          ) : null}

          <div className="filter-panel">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink-soft">Search</span>
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
                <span className="mb-1 block font-medium text-ink-soft">Company</span>
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
                <span className="mb-1 block font-medium text-ink-soft">
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

          <div className="flex items-center justify-between gap-3 text-sm text-muted">
            <p>
              {filtered.length === rows.length
                ? `${rows.length} customer${rows.length === 1 ? "" : "s"}`
                : `${filtered.length} of ${rows.length} customers`}
            </p>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="link-brand"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              No customers match these filters.{" "}
              <button
                type="button"
                onClick={clearFilters}
                className="link-brand"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((c) => {
                const current = currentPassport(c.passports);
                const d = current
                  ? daysUntilISODate(current.passport_expiry)
                  : null;
                return (
                  <li key={c.id}>
                    <Link
                      to={`/customers/${c.id}`}
                      className="list-card"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 font-medium text-ink">
                            {c.full_name}
                          </p>
                          <p className="shrink-0 text-right text-sm text-muted">
                            {c.companies ? (
                              <CompanyChip
                                name={c.companies.name}
                                color={c.companies.color}
                              />
                            ) : (
                              "—"
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-mono text-sm text-ink-soft">
                            {current?.passport_number ?? "No passport"}
                            {(c.passports ?? []).length > 1
                              ? ` · ${(c.passports ?? []).length} passports`
                              : ""}
                          </p>
                          {current && d !== null ? (
                            <div
                              className={`inline-flex flex-col rounded-lg px-3 py-2 text-sm sm:items-end ${urgencyClass(d)}`}
                            >
                              <span className="meta opacity-80">
                                Passport expiry
                              </span>
                              <span className="font-medium tabular-nums">
                                {formatDisplayDate(current.passport_expiry)}
                              </span>
                              <span className="text-xs opacity-90">
                                {d < 0
                                  ? `Expired ${Math.abs(d)}d ago`
                                  : d === 0
                                    ? "Expires today (UTC)"
                                    : `${d}d until expiry (UTC)`}
                              </span>
                            </div>
                          ) : (
                            <p className="text-sm text-muted">No expiry date</p>
                          )}
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

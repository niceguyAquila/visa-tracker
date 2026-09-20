import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AddFab } from "../components/AddFab";
import { daysUntilISODate, formatDisplayDate, formatOptionalDisplayDate } from "../lib/dates";
import {
  landedBadgeClass,
  landedLabel,
  statusBadgeClass,
  statusRowClass,
  urgencyCellClass,
} from "../lib/ui";
import { ARCHIVE_STATUSES, isVisaLanded } from "../lib/visa";
import { supabase } from "../lib/supabase";
import type { Company, VisaWithCustomer } from "../types";

const PAGE_SIZES = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];
const DEFAULT_PAGE_SIZE: PageSize = 50;

const inputClass = "input-field text-sm";

type UrgencyFilter = "all" | "expired" | "today" | "10" | "30" | "ok";
type ExtDoneFilter = "all" | "yes" | "no";
type LandedFilter = "all" | "yes" | "no";
type ArchiveStatusFilter = "all" | "Cuti" | "Blacklist" | "Finished";

type SortKey =
  | "status"
  | "name"
  | "passport"
  | "route"
  | "company"
  | "visa_days"
  | "date_entered"
  | "date_to_extension"
  | "date_extended"
  | "extension_done"
  | "leave_date_reminder"
  | "actual_leave_date"
  | "cycle_done";

const SORT_KEYS: SortKey[] = [
  "status",
  "name",
  "passport",
  "route",
  "company",
  "visa_days",
  "date_entered",
  "date_to_extension",
  "date_extended",
  "extension_done",
  "leave_date_reminder",
  "actual_leave_date",
  "cycle_done",
];

const DEFAULT_SORT: SortKey = "date_to_extension";
const DEFAULT_DIR = "asc" as const;

function todayISO(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function parseUrgency(value: string | null): UrgencyFilter {
  if (
    value === "expired" ||
    value === "today" ||
    value === "10" ||
    value === "30" ||
    value === "ok"
  ) {
    return value;
  }
  return "all";
}

function parseExtDone(value: string | null): ExtDoneFilter {
  if (value === "yes" || value === "no") return value;
  return "all";
}

function parseLanded(value: string | null): LandedFilter {
  if (value === "yes" || value === "no") return value;
  return "all";
}

function remainingDaysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d late`;
  if (days === 0) return "today";
  return `${days}d remaining`;
}

function parseArchiveStatus(value: string | null): ArchiveStatusFilter {
  if (value === "Cuti" || value === "Blacklist" || value === "Finished") {
    return value;
  }
  return "all";
}

function parsePage(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parsePageSize(value: string | null): PageSize {
  const n = Number(value);
  if ((PAGE_SIZES as readonly number[]).includes(n)) {
    return n as PageSize;
  }
  return DEFAULT_PAGE_SIZE;
}

function parseSort(value: string | null): SortKey {
  if (value === "masuk_dari") return "route";
  if (value && (SORT_KEYS as string[]).includes(value)) {
    return value as SortKey;
  }
  return DEFAULT_SORT;
}

function parseDir(value: string | null): "asc" | "desc" {
  if (value === "desc") return "desc";
  if (value === "asc") return "asc";
  return DEFAULT_DIR;
}

const stickyThClass =
  "sticky top-0 z-10 whitespace-nowrap bg-paper px-3 py-2.5 shadow-[inset_0_-1px_0_0_var(--color-line)]";

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "left" | "center" | "right";
}) {
  const active = activeKey === sortKey;
  const alignClass =
    align === "center"
      ? "justify-center text-center"
      : align === "right"
        ? "justify-end text-right"
        : "justify-start text-left";

  return (
    <th className={stickyThClass}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full items-center gap-1 font-medium uppercase tracking-wide hover:text-ink ${alignClass} ${
          active ? "text-ink" : "text-muted"
        }`}
      >
        <span>{label}</span>
        <span className="text-[0.65rem] tabular-nums" aria-hidden="true">
          {active ? (dir === "asc" ? "▲" : "▼") : "◇"}
        </span>
      </button>
    </th>
  );
}

type VisaListProps = {
  mode: "active" | "archive";
};

function VisaList({ mode }: VisaListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const companyId = searchParams.get("company") ?? "";
  const urgency = parseUrgency(searchParams.get("urgency"));
  const extDone = parseExtDone(searchParams.get("ext"));
  const landed = parseLanded(searchParams.get("landed"));
  const archiveStatus = parseArchiveStatus(searchParams.get("status"));
  const page = parsePage(searchParams.get("page"));
  const pageSize = parsePageSize(searchParams.get("size"));
  const sortKey = parseSort(searchParams.get("sort"));
  const sortDir = parseDir(searchParams.get("dir"));

  const [rows, setRows] = useState<VisaWithCustomer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const title = mode === "active" ? "Visa List — Active" : "Visa List — Archive";
  const description =
    mode === "active"
      ? "In-Progress visas, including those that have not landed yet."
      : "Cuti, Blacklist, and Finished visa sessions.";

  const extraFiltersActive = Boolean(
    companyId ||
      urgency !== "all" ||
      extDone !== "all" ||
      (mode === "active" && landed !== "all") ||
      (mode === "archive" && archiveStatus !== "all")
  );
  const filtersActive = Boolean(query.trim() || extraFiltersActive);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: cErr } = await supabase
        .from("companies")
        .select("*")
        .order("name", { ascending: true });
      if (cancelled) return;
      if (cErr) {
        setError(cErr.message);
        return;
      }
      setCompanies((data ?? []) as Company[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const needsCustomerInner = Boolean(
      companyId ||
        sortKey === "name" ||
        sortKey === "company"
    );
    const customerSelect =
      sortKey === "company"
        ? "customers!inner ( id, full_name, company_id, companies!inner ( id, name ) )"
        : needsCustomerInner
          ? "customers!inner ( id, full_name, company_id, companies ( id, name ) )"
          : "customers ( id, full_name, company_id, companies ( id, name ) )";
    const select = `*, ${customerSelect}, passports!passport_id ( id, passport_number, passport_expiry )`;

    let q = supabase.from("visas").select(select, { count: "exact" });

    const ascending = sortDir === "asc";
    switch (sortKey) {
      case "name":
        q = q
          .order("full_name", { ascending, foreignTable: "customers" })
          .order("id", { ascending: true });
        break;
      case "passport":
        q = q
          .order("passport_number", { ascending, foreignTable: "passports" })
          .order("id", { ascending: true });
        break;
      case "company":
        q = q
          .order("name", { ascending, foreignTable: "customers.companies" })
          .order("id", { ascending: true });
        break;
      case "date_entered":
        q = q
          .order(sortKey, { ascending, nullsFirst: true })
          .order("id", { ascending: true });
        break;
      case "date_to_extension":
      case "date_extended":
      case "leave_date_reminder":
      case "actual_leave_date":
        q = q
          .order(sortKey, { ascending, nullsFirst: false })
          .order("id", { ascending: true });
        break;
      default:
        q = q
          .order(sortKey, { ascending })
          .order("id", { ascending: true });
        break;
    }

    if (mode === "active") {
      q = q.eq("status", "In-Progress");
    } else if (archiveStatus !== "all") {
      q = q.eq("status", archiveStatus);
    } else {
      q = q.in("status", ARCHIVE_STATUSES);
    }

    if (extDone === "yes") q = q.eq("extension_done", true);
    if (extDone === "no") q = q.eq("extension_done", false);

    if (mode === "active") {
      if (landed === "yes") q = q.not("date_entered", "is", null);
      if (landed === "no") q = q.is("date_entered", null);
    }

    const today = todayISO();
    if (landed !== "no") {
      if (urgency === "expired") {
        q = q.lt("date_to_extension", today);
      } else if (urgency === "today") {
        q = q.eq("date_to_extension", today);
      } else if (urgency === "10") {
        q = q.gte("date_to_extension", today).lte("date_to_extension", addDaysISO(today, 10));
      } else if (urgency === "30") {
        q = q
          .gt("date_to_extension", addDaysISO(today, 10))
          .lte("date_to_extension", addDaysISO(today, 30));
      } else if (urgency === "ok") {
        q = q.gt("date_to_extension", addDaysISO(today, 30));
      }
    }

    if (companyId) {
      q = q.eq("customers.company_id", companyId);
    }

    const qTrim = query.trim().replace(/[%_,"]/g, "");
    if (qTrim) {
      const pattern = `%${qTrim}%`;
      const [{ data: nameRows }, { data: passRows }] = await Promise.all([
        supabase.from("customers").select("id").ilike("full_name", pattern),
        supabase.from("passports").select("id").ilike("passport_number", pattern),
      ]);
      const customerIds = (nameRows ?? []).map((r) => r.id as string);
      const passportIds = (passRows ?? []).map((r) => r.id as string);
      if (customerIds.length === 0 && passportIds.length === 0) {
        setRows([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
      const parts: string[] = [];
      if (customerIds.length) {
        parts.push(`customer_id.in.(${customerIds.join(",")})`);
      }
      if (passportIds.length) {
        parts.push(`passport_id.in.(${passportIds.join(",")})`);
      }
      q = q.or(parts.join(","));
    }

    const from = (safePage - 1) * pageSize;
    const to = from + pageSize - 1;
    q = q.range(from, to);

    const { data, error: qErr, count } = await q;
    if (qErr) {
      setError(qErr.message);
      setRows([]);
      setTotalCount(0);
    } else {
      setRows((data ?? []) as unknown as VisaWithCustomer[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [
    mode,
    query,
    companyId,
    urgency,
    extDone,
    landed,
    archiveStatus,
    safePage,
    pageSize,
    sortKey,
    sortDir,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  // Clamp page in URL if filters shrink the result set
  useEffect(() => {
    if (!loading && page > totalPages && totalPages >= 1) {
      const next = new URLSearchParams(searchParams);
      if (totalPages <= 1) next.delete("page");
      else next.set("page", String(totalPages));
      setSearchParams(next, { replace: true });
    }
  }, [loading, page, totalPages, searchParams, setSearchParams]);

  const rangeLabel = useMemo(() => {
    if (totalCount === 0) return "0 visas";
    const from = (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, totalCount);
    return `${from}–${to} of ${totalCount}`;
  }, [safePage, pageSize, totalCount]);

  function updateParams(updates: Record<string, string>, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete("page");
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSearchParams({}, { replace: true });
  }

  function goToPage(nextPage: number) {
    updateParams(
      { page: nextPage <= 1 ? "" : String(nextPage) },
      false
    );
  }

  function toggleSort(key: SortKey) {
    const nextDir =
      sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    updateParams({
      sort: key === DEFAULT_SORT ? "" : key,
      dir: nextDir === DEFAULT_DIR ? "" : nextDir,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">{description}</p>
      </div>

      <AddFab to="/visas/new" label="Add visa" storageKey="fab-visas" />

      <div className="filter-panel shrink-0">
        <div className="flex items-end gap-2">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="mb-1 block font-medium text-ink-soft">Search</span>
            <input
              type="search"
              className={inputClass}
              placeholder="Name or passport"
              value={query}
              onChange={(e) => updateParams({ q: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="btn-ghost shrink-0 px-3 py-2 md:hidden"
            aria-expanded={filtersOpen}
            aria-controls="visa-list-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters
            {extraFiltersActive ? (
              <span className="ml-1.5 size-1.5 rounded-full bg-brand" />
            ) : null}
            <span className="ml-1 text-[0.65rem] text-muted" aria-hidden="true">
              {filtersOpen ? "▲" : "▼"}
            </span>
          </button>
        </div>
        <div
          id="visa-list-filters"
          className={`${
            filtersOpen ? "grid" : "hidden"
          } gap-3 sm:grid-cols-2 lg:grid-cols-4 md:grid`}
        >
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
              Extension due
            </span>
            <select
              className={inputClass}
              value={landed === "no" ? "all" : urgency}
              disabled={landed === "no"}
              onChange={(e) =>
                  updateParams({
                    urgency: e.target.value === "all" ? "" : e.target.value,
                  })
              }
            >
              <option value="all">All</option>
              <option value="expired">Overdue</option>
              <option value="today">Due today</option>
              <option value="10">Due ≤10 days</option>
              <option value="30">Due 11–30 days</option>
              <option value="ok">More than 30 days</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-soft">
              Extension done
            </span>
            <select
              className={inputClass}
              value={extDone}
              onChange={(e) =>
                updateParams({
                  ext: e.target.value === "all" ? "" : e.target.value,
                })
              }
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          {mode === "archive" ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink-soft">Status</span>
              <select
                className={inputClass}
                value={archiveStatus}
                onChange={(e) =>
                  updateParams({
                    status: e.target.value === "all" ? "" : e.target.value,
                  })
                }
              >
                <option value="all">All archive</option>
                <option value="Cuti">Cuti</option>
                <option value="Blacklist">Blacklist</option>
                <option value="Finished">Finished</option>
              </select>
            </label>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink-soft">Arrival</span>
              <select
                className={inputClass}
                value={landed}
                onChange={(e) =>
                  updateParams({
                    landed: e.target.value === "all" ? "" : e.target.value,
                  })
                }
              >
                <option value="all">All In-Progress</option>
                <option value="yes">Landed</option>
                <option value="no">Not landed</option>
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>{loading ? "Loading…" : rangeLabel}</p>
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

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : null}

      {!loading && !error && totalCount === 0 ? (
        <div className="empty-state">
          {filtersActive ? (
            <>
              No visas match these filters.{" "}
              <button
                type="button"
                onClick={clearFilters}
                className="link-brand"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              No {mode === "active" ? "active" : "archived"} visas yet.{" "}
              <Link
                to="/visas/new"
                className="link-brand"
              >
                Add a visa
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[86rem] border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs">
                <tr>
                  <th
                    className={`${stickyThClass} text-right font-medium uppercase tracking-wide text-muted`}
                  >
                    #
                  </th>
                  <SortHeader
                    label="Status"
                    sortKey="status"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Name"
                    sortKey="name"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Passport"
                    sortKey="passport"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Route"
                    sortKey="route"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Company"
                    sortKey="company"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Visa Days"
                    sortKey="visa_days"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Arrival Date"
                    sortKey="date_entered"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Extension Date"
                    sortKey="date_to_extension"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Date Extended"
                    sortKey="date_extended"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Extension Done"
                    sortKey="extension_done"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="center"
                  />
                  <SortHeader
                    label="Leave by"
                    sortKey="leave_date_reminder"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Actual Leave"
                    sortKey="actual_leave_date"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Cycle Done"
                    sortKey="cycle_done"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="center"
                  />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="border-t border-line/80 px-3 py-8 text-center text-muted"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : (
                  rows.map((v, index) => {
                    const rowNumber = (safePage - 1) * pageSize + index + 1;
                    const extDays = v.date_to_extension
                      ? daysUntilISODate(v.date_to_extension)
                      : null;
                    const leaveDays = v.leave_date_reminder
                      ? daysUntilISODate(v.leave_date_reminder)
                      : null;
                    const landedHere = isVisaLanded(v.date_entered);
                    const showExtRelative =
                      mode === "active" &&
                      !v.extension_done &&
                      extDays !== null;
                    const showLeaveRelative = mode === "active" && landedHere;
                    return (
                      <tr
                        key={v.id}
                        className={`cursor-pointer ${statusRowClass(v.status, leaveDays, landedHere)}`}
                        tabIndex={0}
                        role="link"
                        onClick={() => navigate(`/visas/${v.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/visas/${v.id}`);
                          }
                        }}
                      >
                        <td className="whitespace-nowrap border-t border-line/80 px-3 py-2 text-right tabular-nums text-muted">
                          {rowNumber}
                        </td>
                        <td className="whitespace-nowrap border-t border-line/80 px-3 py-2">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${statusBadgeClass(v.status)}`}
                            >
                              {v.status}
                            </span>
                            {mode === "active" ? (
                              <span
                                className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${landedBadgeClass(landedHere)}`}
                              >
                                {landedLabel(landedHere)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="max-w-[10rem] truncate border-t border-line/80 px-3 py-2 font-medium text-ink">
                          {v.customers?.full_name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap border-t border-line/80 px-3 py-2 font-mono text-xs text-ink-soft">
                          {v.passports?.passport_number ?? "—"}
                        </td>
                        <td className="max-w-[9rem] truncate border-t border-line/80 px-3 py-2 text-ink-soft">
                          {v.route || "—"}
                        </td>
                        <td className="max-w-[9rem] truncate border-t border-line/80 px-3 py-2 text-ink-soft">
                          {v.customers?.companies?.name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap border-t border-line/80 px-3 py-2 text-ink-soft">
                          {v.visa_days}
                        </td>
                        <td className="whitespace-nowrap border-t border-line/80 px-3 py-2 tabular-nums text-ink-soft">
                          {formatOptionalDisplayDate(
                            v.date_entered,
                            "Not landed"
                          )}
                        </td>
                        <td
                          className={`whitespace-nowrap border-t border-line/80 px-3 py-2 tabular-nums ${
                            showExtRelative && extDays !== null
                              ? urgencyCellClass(extDays)
                              : "text-ink-soft"
                          }`}
                        >
                          <span className="font-medium">
                            {formatOptionalDisplayDate(
                              v.date_to_extension,
                              "—"
                            )}
                          </span>
                          {showExtRelative && extDays !== null ? (
                            <span className="ml-1 text-xs opacity-80">
                              ({remainingDaysLabel(extDays)})
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap border-t border-line/80 px-3 py-2 tabular-nums text-ink-soft">
                          {v.date_extended
                            ? formatDisplayDate(v.date_extended)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap border-t border-line/80 px-3 py-2 text-center text-ink-soft">
                          {v.extension_done ? "Y" : "—"}
                        </td>
                        <td
                          className={`whitespace-nowrap border-t border-line/80 px-3 py-2 tabular-nums ${
                            !v.leave_date_reminder || leaveDays === null
                              ? "text-muted"
                              : leaveDays === 0
                                ? "bg-watch-soft text-watch-ink"
                                : showLeaveRelative
                                  ? urgencyCellClass(leaveDays)
                                  : "text-ink-soft"
                          }`}
                        >
                          {v.leave_date_reminder && leaveDays !== null ? (
                            <>
                              <span className="font-medium">
                                {formatDisplayDate(v.leave_date_reminder)}
                              </span>
                              {showLeaveRelative ? (
                                <span className="ml-1 text-xs opacity-80">
                                  ({leaveDays < 0
                                    ? `${Math.abs(leaveDays)}d late`
                                    : leaveDays === 0
                                      ? "today"
                                      : `${leaveDays}d`})
                                </span>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap border-t border-line/80 px-3 py-2 tabular-nums text-ink-soft">
                          {v.actual_leave_date
                            ? formatDisplayDate(v.actual_leave_date)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap border-t border-line/80 px-3 py-2 text-center text-ink-soft">
                          {v.cycle_done ? "Y" : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 text-muted">
              <span className="whitespace-nowrap">Per page</span>
              <select
                className={`${inputClass} w-auto py-1.5`}
                value={pageSize}
                onChange={(e) =>
                  updateParams({
                    size:
                      Number(e.target.value) === DEFAULT_PAGE_SIZE
                        ? ""
                        : e.target.value,
                  })
                }
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-muted">
              Page {safePage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1 || loading}
                onClick={() => goToPage(safePage - 1)}
                className="btn-ghost px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages || loading}
                onClick={() => goToPage(safePage + 1)}
                className="btn-ghost px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
}

export function VisaListActivePage() {
  return <VisaList mode="active" />;
}

export function VisaListArchivePage() {
  return <VisaList mode="archive" />;
}

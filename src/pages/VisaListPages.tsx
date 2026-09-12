import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { daysUntilISODate, formatDisplayDate } from "../lib/dates";
import { ARCHIVE_STATUSES } from "../lib/visa";
import { supabase } from "../lib/supabase";
import type { Company, VisaStatus, VisaWithCustomer } from "../types";

const PAGE_SIZE = 50;

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

type UrgencyFilter = "all" | "expired" | "10" | "30" | "ok";
type ExtDoneFilter = "all" | "yes" | "no";
type ArchiveStatusFilter = "all" | "Cuti" | "Blacklist" | "Finished";

type SortKey =
  | "status"
  | "name"
  | "passport"
  | "masuk_dari"
  | "company"
  | "visa_days"
  | "date_entered"
  | "date_to_extension"
  | "date_extended"
  | "extension_done"
  | "leave_date_reminder"
  | "cycle_done";

const SORT_KEYS: SortKey[] = [
  "status",
  "name",
  "passport",
  "masuk_dari",
  "company",
  "visa_days",
  "date_entered",
  "date_to_extension",
  "date_extended",
  "extension_done",
  "leave_date_reminder",
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

function urgencyCellClass(days: number): string {
  if (days < 0) return "text-red-700";
  if (days === 0) return "text-yellow-800";
  if (days <= 10) return "text-amber-800";
  if (days <= 30) return "text-yellow-800";
  return "text-slate-700";
}

function statusBadgeClass(status: VisaStatus): string {
  switch (status) {
    case "In-Progress":
      return "bg-blue-100 text-blue-900";
    case "Cuti":
      return "bg-green-200 text-green-900";
    case "Blacklist":
      return "bg-cyan-200 text-cyan-900";
    case "Finished":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function rowClass(
  status: VisaStatus,
  leaveDays: number | null
): string {
  if (status === "Cuti") return "bg-green-50 hover:bg-green-100";
  if (status === "Blacklist") return "bg-cyan-50 hover:bg-cyan-100";
  if (leaveDays === 0) return "bg-yellow-100 hover:bg-yellow-200";
  return "bg-white hover:bg-slate-50";
}

function parseUrgency(value: string | null): UrgencyFilter {
  if (value === "expired" || value === "10" || value === "30" || value === "ok") {
    return value;
  }
  return "all";
}

function parseExtDone(value: string | null): ExtDoneFilter {
  if (value === "yes" || value === "no") return value;
  return "all";
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

function parseSort(value: string | null): SortKey {
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
    <th className="whitespace-nowrap px-3 py-2.5">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full items-center gap-1 font-medium uppercase tracking-wide hover:text-slate-800 ${alignClass} ${
          active ? "text-slate-800" : "text-slate-500"
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
  const archiveStatus = parseArchiveStatus(searchParams.get("status"));
  const page = parsePage(searchParams.get("page"));
  const sortKey = parseSort(searchParams.get("sort"));
  const sortDir = parseDir(searchParams.get("dir"));

  const [rows, setRows] = useState<VisaWithCustomer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const title = mode === "active" ? "Visa List — Active" : "Visa List — Archive";
  const description =
    mode === "active"
      ? "In-Progress visa sessions currently being tracked."
      : "Cuti, Blacklist, and Finished visa sessions.";

  const filtersActive = Boolean(
    query.trim() ||
      companyId ||
      urgency !== "all" ||
      extDone !== "all" ||
      (mode === "archive" && archiveStatus !== "all")
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
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
      query.trim() ||
        companyId ||
        sortKey === "name" ||
        sortKey === "passport" ||
        sortKey === "company"
    );
    const select =
      sortKey === "company"
        ? "*, customers!inner ( id, full_name, passport_number, company_id, companies!inner ( id, name ) )"
        : needsCustomerInner
          ? "*, customers!inner ( id, full_name, passport_number, company_id, companies ( id, name ) )"
          : "*, customers ( id, full_name, passport_number, company_id, companies ( id, name ) )";

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
          .order("passport_number", { ascending, foreignTable: "customers" })
          .order("id", { ascending: true });
        break;
      case "company":
        q = q
          .order("name", { ascending, foreignTable: "customers.companies" })
          .order("id", { ascending: true });
        break;
      case "date_extended":
      case "leave_date_reminder":
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

    const today = todayISO();
    if (urgency === "expired") {
      q = q.lt("date_to_extension", today);
    } else if (urgency === "10") {
      q = q.gte("date_to_extension", today).lte("date_to_extension", addDaysISO(today, 10));
    } else if (urgency === "30") {
      q = q.gte("date_to_extension", today).lte("date_to_extension", addDaysISO(today, 30));
    } else if (urgency === "ok") {
      q = q.gt("date_to_extension", addDaysISO(today, 30));
    }

    if (companyId) {
      q = q.eq("customers.company_id", companyId);
    }

    const qTrim = query.trim().replace(/[%_,"]/g, "");
    if (qTrim) {
      const pattern = `%${qTrim}%`;
      q = q.or(
        `full_name.ilike."${pattern}",passport_number.ilike."${pattern}"`,
        { foreignTable: "customers" }
      );
    }

    const from = (safePage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    q = q.range(from, to);

    const { data, error: qErr, count } = await q;
    if (qErr) {
      setError(qErr.message);
      setRows([]);
      setTotalCount(0);
    } else {
      setRows((data ?? []) as VisaWithCustomer[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [
    mode,
    query,
    companyId,
    urgency,
    extDone,
    archiveStatus,
    safePage,
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
    const from = (safePage - 1) * PAGE_SIZE + 1;
    const to = Math.min(safePage * PAGE_SIZE, totalCount);
    return `${from}–${to} of ${totalCount}`;
  }, [safePage, totalCount]);

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
    <div className="space-y-4 pb-16">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </div>

      <Link
        to="/visas/new"
        aria-label="Add visa"
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

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Search</span>
          <input
            type="search"
            className={inputClass}
            placeholder="Name or passport"
            value={query}
            onChange={(e) => updateParams({ q: e.target.value })}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              Extension due
            </span>
            <select
              className={inputClass}
              value={urgency}
              onChange={(e) =>
                updateParams({
                  urgency: e.target.value === "all" ? "" : e.target.value,
                })
              }
            >
              <option value="all">All</option>
              <option value="expired">Overdue</option>
              <option value="10">Due ≤10 days</option>
              <option value="30">Due ≤30 days</option>
              <option value="ok">More than 30 days</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">
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
              <span className="mb-1 block font-medium text-slate-600">Status</span>
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
            <div className="hidden lg:block" />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p>{loading ? "Loading…" : rangeLabel}</p>
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

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      {!loading && !error && totalCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
          {filtersActive ? (
            <>
              No visas match these filters.{" "}
              <button
                type="button"
                onClick={clearFilters}
                className="font-medium text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              No {mode === "active" ? "active" : "archived"} visas yet.{" "}
              <Link
                to="/visas/new"
                className="font-medium text-blue-600 hover:underline"
              >
                Add a visa
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[78rem] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium uppercase tracking-wide text-slate-500">
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
                    label="Masuk Dari"
                    sortKey="masuk_dari"
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
                    label="Leave Date"
                    sortKey="leave_date_reminder"
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
                      colSpan={13}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : (
                  rows.map((v, index) => {
                    const rowNumber = (safePage - 1) * PAGE_SIZE + index + 1;
                    const extDays = daysUntilISODate(v.date_to_extension);
                    const leaveDays = v.leave_date_reminder
                      ? daysUntilISODate(v.leave_date_reminder)
                      : null;
                    const showExtRelative =
                      mode === "active" && !v.extension_done;
                    const showLeaveRelative = mode === "active";
                    return (
                      <tr
                        key={v.id}
                        className={`cursor-pointer border-t border-slate-100 ${rowClass(v.status, leaveDays)}`}
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
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-500">
                          {rowNumber}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${statusBadgeClass(v.status)}`}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="max-w-[10rem] truncate px-3 py-2 font-medium text-slate-900">
                          {v.customers?.full_name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700">
                          {v.customers?.passport_number ?? "—"}
                        </td>
                        <td className="max-w-[9rem] truncate px-3 py-2 text-slate-700">
                          {v.masuk_dari || "—"}
                        </td>
                        <td className="max-w-[9rem] truncate px-3 py-2 text-slate-700">
                          {v.customers?.companies?.name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {v.visa_days}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700">
                          {formatDisplayDate(v.date_entered)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2 tabular-nums ${
                            showExtRelative
                              ? urgencyCellClass(extDays)
                              : "text-slate-700"
                          }`}
                        >
                          <span className="font-medium">
                            {formatDisplayDate(v.date_to_extension)}
                          </span>
                          {showExtRelative ? (
                            <span className="ml-1 text-xs opacity-80">
                              ({extDays < 0
                                ? `${Math.abs(extDays)}d late`
                                : extDays === 0
                                  ? "today"
                                  : `${extDays}d`})
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700">
                          {v.date_extended
                            ? formatDisplayDate(v.date_extended)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-center text-slate-700">
                          {v.extension_done ? "Y" : "—"}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2 tabular-nums ${
                            !v.leave_date_reminder || leaveDays === null
                              ? "text-slate-400"
                              : leaveDays === 0
                                ? "bg-yellow-200/80 text-yellow-900"
                                : showLeaveRelative
                                  ? urgencyCellClass(leaveDays)
                                  : "text-slate-700"
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
                        <td className="whitespace-nowrap px-3 py-2 text-center text-slate-700">
                          {v.cycle_done ? "Y" : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-slate-600">
                Page {safePage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1 || loading}
                  onClick={() => goToPage(safePage - 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages || loading}
                  onClick={() => goToPage(safePage + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
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

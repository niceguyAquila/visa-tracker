import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CompanyChip } from "../components/CompanyChip";
import {
  currentPassport,
  CUSTOMER_LIST_SELECT,
  friendlyMergeConflict,
  normalizePersonName,
  sortPassports,
  unresolvedDuplicateGroups,
} from "../lib/customer";
import { formatDisplayDate } from "../lib/dates";
import { supabase } from "../lib/supabase";
import type { CustomerWithCompany, DuplicateExclusion } from "../types";

type InProgressMap = Record<string, number>;

export function CustomerDuplicatesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CustomerWithCompany[]>([]);
  const [exclusions, setExclusions] = useState<DuplicateExclusion[]>([]);
  const [inProgress, setInProgress] = useState<InProgressMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keepByGroup, setKeepByGroup] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [
      { data, error: qErr },
      { data: visaRows, error: vErr },
      { data: exRows, error: exErr },
    ] = await Promise.all([
        supabase
          .from("customers")
          .select(CUSTOMER_LIST_SELECT)
          .order("full_name", { ascending: true }),
        supabase
          .from("visas")
          .select("customer_id")
          .eq("status", "In-Progress"),
        supabase.from("duplicate_exclusions").select("*"),
      ]);
    if (qErr) {
      setError(qErr.message);
      setRows([]);
      setExclusions([]);
      setInProgress({});
      setLoading(false);
      return;
    }
    if (vErr) {
      setError(vErr.message);
      setRows([]);
      setExclusions([]);
      setInProgress({});
      setLoading(false);
      return;
    }
    if (exErr && !/schema cache|does not exist/i.test(exErr.message)) {
      setError(exErr.message);
      setRows([]);
      setExclusions([]);
      setInProgress({});
      setLoading(false);
      return;
    }

    const customers = ((data ?? []) as CustomerWithCompany[]).map((c) => ({
      ...c,
      passports: c.passports ?? [],
    }));
    const counts: InProgressMap = {};
    for (const row of visaRows ?? []) {
      const id = (row as { customer_id: string }).customer_id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    setRows(customers);
    setExclusions((exRows ?? []) as DuplicateExclusion[]);
    setInProgress(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(
    () => unresolvedDuplicateGroups(rows, exclusions),
    [rows, exclusions]
  );

  useEffect(() => {
    setKeepByGroup((prev) => {
      const next = { ...prev };
      for (const group of groups) {
        const key = groupKey(group);
        if (!next[key] || !group.some((c) => c.id === next[key])) {
          next[key] = oldestId(group);
        }
      }
      return next;
    });
  }, [groups]);

  async function mergeGroup(group: CustomerWithCompany[]) {
    const key = groupKey(group);
    const keepId = keepByGroup[key] ?? oldestId(group);
    const absorbIds = group.filter((c) => c.id !== keepId).map((c) => c.id);
    if (absorbIds.length === 0) return;

    const inProgressTotal = group.reduce(
      (sum, c) => sum + (inProgress[c.id] ?? 0),
      0
    );
    if (inProgressTotal > 1) return;

    if (
      !confirm(
        `Merge ${absorbIds.length} duplicate${absorbIds.length === 1 ? "" : "s"} into the selected customer? This cannot be undone.`
      )
    ) {
      return;
    }

    setBusyKey(key);
    setError(null);
    const { error: mErr } = await supabase.rpc("merge_customers", {
      keep_id: keepId,
      absorb_ids: absorbIds,
    });
    setBusyKey(null);
    if (mErr) {
      setError(friendlyMergeConflict(mErr.message));
      return;
    }
    navigate(`/customers/${keepId}`, {
      state: { flashSuccess: "Customers merged." },
    });
  }

  async function markDistinct(group: CustomerWithCompany[]) {
    const key = groupKey(group);
    if (
      !confirm(
        "Mark these as different people? They will leave this list unless another person with the same name is added later."
      )
    ) {
      return;
    }

    setBusyKey(key);
    setError(null);
    const { error: uErr } = await supabase.from("duplicate_exclusions").upsert(
      {
        org_id: group[0].org_id,
        company_id: group[0].company_id,
        name_key: normalizePersonName(group[0].full_name),
        customer_ids: [...group.map((c) => c.id)].sort(),
      },
      { onConflict: "org_id,company_id,name_key" }
    );
    setBusyKey(null);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/customers" className="link-brand text-sm">
          ← Customers
        </Link>
        <h1 className="page-title mt-2">Possible duplicates</h1>
        <p className="page-sub mt-1">
          Same name and company, different passports. Merge renewals, or mark
          people who just share a name as distinct.
        </p>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          No unresolved same-name groups. Different people who share a name can
          stay as separate customers.
        </div>
      ) : (
        <ul className="space-y-5">
          {groups.map((group) => {
            const key = groupKey(group);
            const keepId = keepByGroup[key] ?? oldestId(group);
            const inProgressTotal = group.reduce(
              (sum, c) => sum + (inProgress[c.id] ?? 0),
              0
            );
            const blocked = inProgressTotal > 1;
            const company = group[0].companies;
            return (
              <li key={key} className="panel space-y-4 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-ink">
                      {group[0].full_name}
                    </h2>
                    <div className="mt-1">
                      {company ? (
                        <CompanyChip name={company.name} color={company.color} />
                      ) : (
                        <p className="text-sm text-muted">—</p>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {group.length} records
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <button
                      type="button"
                      disabled={busyKey === key}
                      onClick={() => void markDistinct(group)}
                      className="btn-ghost sm:w-auto"
                    >
                      {busyKey === key ? "Saving…" : "Different people"}
                    </button>
                    <button
                      type="button"
                      disabled={blocked || busyKey === key}
                      onClick={() => void mergeGroup(group)}
                      className="btn-primary sm:w-auto disabled:opacity-40"
                    >
                      {busyKey === key ? "Working…" : "Merge into selected"}
                    </button>
                  </div>
                </div>

                {blocked ? (
                  <p className="text-sm text-red-700">
                    More than one In-Progress visa in this group. Finish or archive extras before merging.
                  </p>
                ) : null}

                <ul className="space-y-3">
                  {group.map((c) => {
                    const current = currentPassport(c.passports);
                    const passports = sortPassports(c.passports ?? []);
                    const selected = c.id === keepId;
                    return (
                      <li key={c.id}>
                        <label
                          className={`flex cursor-pointer flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-start sm:justify-between ${
                            selected
                              ? "border-brand bg-brand-soft/40"
                              : "border-line bg-paper"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name={`keep-${key}`}
                              checked={selected}
                              onChange={() =>
                                setKeepByGroup((prev) => ({
                                  ...prev,
                                  [key]: c.id,
                                }))
                              }
                              className="mt-1"
                            />
                            <div>
                              <p className="font-medium text-ink">
                                {selected ? "Keep this customer" : "Merge into selected"}
                              </p>
                              <p className="text-xs text-muted">
                                {c.visa_count} visa count · {c.extension_count} extensions
                                {(inProgress[c.id] ?? 0) > 0
                                  ? " · In-Progress visa"
                                  : ""}
                              </p>
                              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                                {passports.map((p) => (
                                  <li key={p.id} className="font-mono text-xs">
                                    {p.passport_number}
                                    {p.is_current ? " (current)" : ""}
                                    {" · exp "}
                                    {formatDisplayDate(p.passport_expiry)}
                                  </li>
                                ))}
                                {passports.length === 0 ? (
                                  <li>{current?.passport_number ?? "No passport"}</li>
                                ) : null}
                              </ul>
                            </div>
                          </div>
                          <Link
                            to={`/customers/${c.id}`}
                            className="link-brand text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open
                          </Link>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function groupKey(group: CustomerWithCompany[]): string {
  return group
    .map((c) => c.id)
    .sort()
    .join(":");
}

function oldestId(group: CustomerWithCompany[]): string {
  return [...group].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  )[0].id;
}

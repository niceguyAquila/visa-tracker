import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CompanySwatch } from "../components/CompanyChip";
import {
  COMPANY_COLORS,
  companyColorLabel,
  companySwatchClass,
  isCompanyColor,
  type CompanyColorName,
} from "../lib/companyColor";
import { getDefaultOrgId } from "../lib/org";
import { supabase } from "../lib/supabase";
import type { Company } from "../types";

function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: CompanyColorName | null;
  onChange: (color: CompanyColorName | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-ink-soft">Color</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
            value === null
              ? "border-ink bg-paper text-ink"
              : "border-line bg-surface text-muted hover:bg-paper"
          } disabled:opacity-60`}
        >
          None
        </button>
        {COMPANY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            title={companyColorLabel(c)}
            aria-label={companyColorLabel(c)}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className={`flex size-8 items-center justify-center rounded-full border-2 ${
              value === c ? "border-ink" : "border-transparent"
            } disabled:opacity-60`}
          >
            <span
              className={`size-5 rounded-full ${companySwatchClass(c)}`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function CompanySettings() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState<CompanyColorName | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<CompanyColorName | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { orgId: defaultOrgId, error: orgErr } = await getDefaultOrgId();
    if (orgErr || !defaultOrgId) {
      setError(orgErr ?? "No organization found.");
      setCompanies([]);
      setLoading(false);
      return;
    }
    setOrgId(defaultOrgId);

    const { data, error: qErr } = await supabase
      .from("companies")
      .select("*")
      .order("name", { ascending: true });
    if (qErr) {
      setError(qErr.message);
      setCompanies([]);
    } else {
      setCompanies((data ?? []) as Company[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const { error: iErr } = await supabase.from("companies").insert({
      org_id: orgId,
      name: trimmed,
      color,
    });
    setBusy(false);
    if (iErr) {
      setError(iErr.message);
      return;
    }
    setName("");
    setColor(null);
    await load();
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const { error: uErr } = await supabase
      .from("companies")
      .update({ name: trimmed, color: editColor })
      .eq("id", editingId);
    setBusy(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setEditingId(null);
    setEditName("");
    setEditColor(null);
    await load();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this company? It cannot be deleted if customers are assigned to it.")) {
      return;
    }
    setError(null);
    const { error: dErr } = await supabase.from("companies").delete().eq("id", id);
    if (dErr) {
      setError(
        dErr.message.includes("foreign key") || dErr.code === "23503"
          ? "Cannot delete: customers are still assigned to this company."
          : dErr.message
      );
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Companies</h2>
        <p className="page-sub">
          Group customers under a company name and optional color.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="panel space-y-3 p-4"
      >
        <label className="block">
          <span className="text-sm font-medium text-ink-soft">Company name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="input-field mt-1"
          />
        </label>
        <ColorPicker value={color} onChange={setColor} disabled={busy} />
        <button
          type="submit"
          disabled={busy || !orgId}
          className="btn-primary"
        >
          {busy ? "Saving…" : "Add company"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : companies.length === 0 ? (
        <div className="empty-state">
          No companies yet. Add one above, then create customers.
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {companies.map((co) => (
            <li key={co.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              {editingId === co.id ? (
                <form onSubmit={onSaveEdit} className="flex flex-1 flex-col gap-3">
                  <input
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-field"
                  />
                  <ColorPicker
                    value={editColor}
                    onChange={setEditColor}
                    disabled={busy}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="btn-primary px-3 py-1.5"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditName("");
                        setEditColor(null);
                      }}
                      className="btn-ghost px-3 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <CompanySwatch color={co.color} className="size-3.5" />
                    <p className="truncate font-medium text-ink">{co.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(co.id);
                        setEditName(co.name);
                        setEditColor(isCompanyColor(co.color) ? co.color : null);
                      }}
                      className="btn-ghost px-3 py-1.5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(co.id)}
                      className="btn-danger px-3 py-1.5"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

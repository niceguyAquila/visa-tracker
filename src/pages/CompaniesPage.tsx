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
      <span className="text-sm font-medium text-slate-700">Color</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
            value === null
              ? "border-slate-800 bg-slate-100 text-slate-900"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
              value === c ? "border-slate-900" : "border-transparent"
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

export function CompaniesPage() {
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
        <h1 className="text-2xl font-semibold text-slate-900">Companies</h1>
        <p className="text-sm text-slate-600">
          Group customers under a company name and optional color.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Company name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <ColorPicker value={color} onChange={setColor} disabled={busy} />
        <button
          type="submit"
          disabled={busy || !orgId}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add company"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
          No companies yet. Add one above, then create customers.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {companies.map((co) => (
            <li key={co.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              {editingId === co.id ? (
                <form onSubmit={onSaveEdit} className="flex flex-1 flex-col gap-3">
                  <input
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
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
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <CompanySwatch color={co.color} className="size-3.5" />
                    <p className="truncate font-medium text-slate-900">{co.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(co.id);
                        setEditName(co.name);
                        setEditColor(isCompanyColor(co.color) ? co.color : null);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(co.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
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

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getDefaultOrgId } from "../lib/org";
import { supabase } from "../lib/supabase";
import type { Company } from "../types";

export function CompaniesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
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
    });
    setBusy(false);
    if (iErr) {
      setError(iErr.message);
      return;
    }
    setName("");
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
      .update({ name: trimmed })
      .eq("id", editingId);
    setBusy(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setEditingId(null);
    setEditName("");
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
          Group customers under a company name.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <label className="block flex-1">
          <span className="text-sm font-medium text-slate-700">Company name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
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
                <form onSubmit={onSaveEdit} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="font-medium text-slate-900">{co.name}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(co.id);
                        setEditName(co.name);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Rename
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

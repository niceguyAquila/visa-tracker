import { useCallback, useEffect, useState, type FormEvent } from "react";
import { DEFAULT_ENTRY_PORTS, existingEntryPort } from "../../lib/visa";
import { getDefaultOrgId } from "../../lib/org";
import { supabase } from "../../lib/supabase";
import type { EntryPort } from "../../types";

export function PortSettings() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [ports, setPorts] = useState<EntryPort[]>([]);
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
      setPorts([]);
      setLoading(false);
      return;
    }
    setOrgId(defaultOrgId);

    const { data, error: qErr } = await supabase
      .from("entry_ports")
      .select("*")
      .order("name", { ascending: true });
    if (qErr) {
      setError(qErr.message);
      setPorts([]);
    } else {
      setPorts((data ?? []) as EntryPort[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const customPorts = ports.filter(
    (port) => !existingEntryPort(port.name, [...DEFAULT_ENTRY_PORTS])
  );

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (existingEntryPort(trimmed, [...DEFAULT_ENTRY_PORTS, ...ports.map((p) => p.name)])) {
      setError("That port is already in the list.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: iErr } = await supabase.from("entry_ports").insert({
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
    const others = ports
      .filter((p) => p.id !== editingId)
      .map((p) => p.name);
    if (existingEntryPort(trimmed, [...DEFAULT_ENTRY_PORTS, ...others])) {
      setError("That port is already in the list.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: uErr } = await supabase
      .from("entry_ports")
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
    if (!confirm("Delete this port? Existing visas keep the old name until edited.")) {
      return;
    }
    setError(null);
    const { error: dErr } = await supabase.from("entry_ports").delete().eq("id", id);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Entry ports</h2>
        <p className="page-sub">
          Options for Masuk dari on visa forms.
        </p>
      </div>

      <form onSubmit={onCreate} className="panel space-y-3 p-4">
        <label className="block">
          <span className="text-sm font-medium text-ink-soft">Port name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tuas"
            className="input-field mt-1"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !orgId}
          className="btn-primary"
        >
          {busy ? "Saving…" : "Add port"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div>
        <p className="meta">Built-in</p>
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
          {DEFAULT_ENTRY_PORTS.map((port) => (
            <li key={port} className="px-4 py-3 text-sm text-ink">
              {port}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="meta">Custom</p>
        {loading ? (
          <p className="mt-2 text-muted">Loading…</p>
        ) : customPorts.length === 0 ? (
          <div className="empty-state mt-2">
            No custom ports yet. Add one above to show it in Masuk dari.
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
            {customPorts.map((port) => (
              <li
                key={port.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                {editingId === port.id ? (
                  <form onSubmit={onSaveEdit} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field"
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
                        }}
                        className="btn-ghost px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="truncate font-medium text-ink">{port.name}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(port.id);
                          setEditName(port.name);
                        }}
                        className="btn-ghost px-3 py-1.5"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(port.id)}
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
    </div>
  );
}

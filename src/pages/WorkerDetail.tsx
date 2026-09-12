import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDisplayDate } from "../lib/dates";
import type { VisaRecord, Worker } from "../types";

const emptyVisa = {
  visa_label: "Work visa",
  issue_date: "",
  expiry_date: "",
  extension_deadline: "",
  notes: "",
};

export function WorkerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [visas, setVisas] = useState<VisaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyVisa);
  const [formBusy, setFormBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data: w, error: wErr } = await supabase
      .from("workers")
      .select("*")
      .eq("id", id)
      .single();
    if (wErr || !w) {
      setError(wErr?.message ?? "Not found");
      setWorker(null);
      setVisas([]);
      setLoading(false);
      return;
    }
    setWorker(w as Worker);

    const { data: v, error: vErr } = await supabase
      .from("visa_records")
      .select("*")
      .eq("worker_id", id)
      .order("expiry_date", { ascending: true });

    if (vErr) setError(vErr.message);
    setVisas((v ?? []) as VisaRecord[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setEditingId(null);
    setForm(emptyVisa);
    setShowForm(true);
  }

  function openEdit(v: VisaRecord) {
    setEditingId(v.id);
    setForm({
      visa_label: v.visa_label,
      issue_date: v.issue_date ?? "",
      expiry_date: v.expiry_date,
      extension_deadline: v.extension_deadline ?? "",
      notes: v.notes ?? "",
    });
    setShowForm(true);
  }

  async function onSubmitVisa(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!form.expiry_date) return;
    setFormBusy(true);
    setError(null);

    const payload = {
      visa_label: form.visa_label.trim() || "Visa",
      issue_date: form.issue_date.trim() || null,
      expiry_date: form.expiry_date,
      extension_deadline: form.extension_deadline.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editingId) {
      const { error: uErr } = await supabase
        .from("visa_records")
        .update(payload)
        .eq("id", editingId);
      setFormBusy(false);
      if (uErr) {
        setError(uErr.message);
        return;
      }
    } else {
      const { error: iErr } = await supabase.from("visa_records").insert({
        worker_id: id,
        ...payload,
      });
      setFormBusy(false);
      if (iErr) {
        setError(iErr.message);
        return;
      }
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyVisa);
    await load();
  }

  async function removeVisa(vid: string) {
    if (!confirm("Delete this visa record?")) return;
    const { error: dErr } = await supabase.from("visa_records").delete().eq("id", vid);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    await load();
  }

  async function removeWorker() {
    if (!id) return;
    if (!confirm("Delete this worker and all visa records?")) return;
    const { error: dErr } = await supabase.from("workers").delete().eq("id", id);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    navigate("/");
  }

  if (!id) return null;

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (!worker) {
    return (
      <div className="space-y-2">
        <p className="text-red-600">{error ?? "Not found"}</p>
        <Link to="/" className="text-sm font-medium text-blue-600 hover:underline">
          ← Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm font-medium text-blue-600 hover:underline">
          ← Workers
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{worker.full_name}</h1>
            {worker.employer_ref ? (
              <p className="text-slate-600">{worker.employer_ref}</p>
            ) : null}
            {worker.notes ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{worker.notes}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/workers/${id}/edit`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Edit profile
            </Link>
            <button
              type="button"
              onClick={() => void removeWorker()}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Delete worker
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Visas</h2>
          <button
            type="button"
            onClick={openNew}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add visa
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        {showForm ? (
          <form
            onSubmit={onSubmitVisa}
            className="mt-4 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-3"
          >
            <p className="text-sm font-medium text-slate-800">
              {editingId ? "Edit visa" : "New visa"}
            </p>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Label</span>
              <input
                value={form.visa_label}
                onChange={(e) => setForm((f) => ({ ...f, visa_label: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Issue (optional)</span>
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Expiry</span>
                <input
                  type="date"
                  required
                  value={form.expiry_date}
                  onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Extension by (optional)</span>
                <input
                  type="date"
                  value={form.extension_deadline}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, extension_deadline: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Notes (optional)</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={formBusy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {formBusy ? "Saving…" : "Save visa"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <ul className="mt-4 divide-y divide-slate-100">
          {visas.length === 0 ? (
            <li className="py-6 text-center text-sm text-slate-500">No visas yet.</li>
          ) : (
            visas.map((v) => (
              <li key={v.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:justify-between">
                <div>
                  <p className="font-medium text-slate-900">{v.visa_label}</p>
                  <p className="text-sm text-slate-600">
                    Expires <span className="font-medium">{formatDisplayDate(v.expiry_date)}</span>
                    {v.issue_date ? (
                      <>
                        {" "}
                        · Issued {formatDisplayDate(v.issue_date)}
                      </>
                    ) : null}
                  </p>
                  {v.extension_deadline ? (
                    <p className="text-sm text-slate-600">
                      Extension target: {formatDisplayDate(v.extension_deadline)}
                    </p>
                  ) : null}
                  {v.notes ? (
                    <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{v.notes}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-400">
                    D-10 email: {v.reminder_10d_sent ? "sent for this expiry date" : "not sent yet"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(v)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeVisa(v.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

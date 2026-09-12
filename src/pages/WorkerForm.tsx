import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Worker } from "../types";

export function WorkerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [employerRef, setEmployerRef] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: mem, error: mErr } = await supabase
        .from("organization_members")
        .select("org_id")
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (mErr || !mem?.org_id) {
        setError(mErr?.message ?? "No organization membership found.");
        return;
      }
      setOrgId(mem.org_id);

      if (!id) return;

      const { data: w, error: wErr } = await supabase
        .from("workers")
        .select("*")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (wErr || !w) {
        setError(wErr?.message ?? "Worker not found.");
        return;
      }
      const worker = w as Worker;
      setFullName(worker.full_name);
      setEmployerRef(worker.employer_ref ?? "");
      setNotes(worker.notes ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setError(null);
    setBusy(true);

    if (isEdit && id) {
      const { error: uErr } = await supabase
        .from("workers")
        .update({
          full_name: fullName.trim(),
          employer_ref: employerRef.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", id);
      setBusy(false);
      if (uErr) {
        setError(uErr.message);
        return;
      }
      navigate(`/workers/${id}`);
      return;
    }

    const { data, error: iErr } = await supabase
      .from("workers")
      .insert({
        org_id: orgId,
        full_name: fullName.trim(),
        employer_ref: employerRef.trim() || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    setBusy(false);
    if (iErr || !data) {
      setError(iErr?.message ?? "Could not create worker.");
      return;
    }
    navigate(`/workers/${(data as { id: string }).id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={isEdit && id ? `/workers/${id}` : "/"}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {isEdit ? "Edit worker" : "New worker"}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Full name</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Employer / reference <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <input
            value={employerRef}
            onChange={(e) => setEmployerRef(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Notes (optional)</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !orgId}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
        >
          {busy ? "Saving…" : isEdit ? "Save" : "Create worker"}
        </button>
      </form>
    </div>
  );
}

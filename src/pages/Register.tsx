import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Register() {
  const { session, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const { error: err } = await signUp(
      email.trim(),
      password,
      inviteCode.trim()
    );
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo(
      "Check your email to confirm your account (if confirmation is enabled in Supabase), then sign in."
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Create manager account</h1>
      <p className="mt-1 text-sm text-slate-600">
        Use the invite code from your team admin. Already registered?{" "}
        <Link className="font-medium text-blue-600 underline" to="/login">
          Sign in
        </Link>
        .
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Invite code</span>
          <input
            type="text"
            required
            autoComplete="off"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="text-sm text-green-700" role="status">
            {info}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Register"}
        </button>
      </form>
    </div>
  );
}

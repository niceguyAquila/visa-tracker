import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
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
    <div className="flex min-h-dvh flex-col justify-center bg-paper px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <BrandMark to="/register" />
        <p className="mt-2 text-sm text-muted">
          Track worker visa expiry for your team.
        </p>

        <div className="panel mt-8 p-6">
          <h1 className="page-title">Create manager account</h1>
          <p className="page-sub mt-1 text-pretty">
            Use the invite code from your team admin. Already registered?{" "}
            <Link className="link-brand" to="/login">
              Sign in
            </Link>
            .
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink-soft">Invite code</span>
              <input
                type="text"
                required
                autoComplete="off"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="input-field mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-soft">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-soft">Password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field mt-1"
              />
            </label>
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="text-sm text-success-ink" role="status">
                {info}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Creating…" : "Register"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

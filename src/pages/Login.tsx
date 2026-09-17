import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";
import { consumeIdleSignOut } from "../lib/session";

export function Login() {
  const { signIn } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [idleNotice] = useState(() => {
    const flagged = consumeIdleSignOut();
    return searchParams.get("reason") === "idle" || flagged;
  });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err.message);
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-paper px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <BrandMark to="/login" />
        <p className="mt-2 text-sm text-muted">
          Track worker visa expiry for your team.
        </p>

        <div className="panel mt-8 p-6">
          <h1 className="page-title">Sign in</h1>
          <p className="page-sub mt-1 text-pretty">
            Manager access only. Need an account?{" "}
            <Link className="link-brand" to="/register">
              Register with invite code
            </Link>
            .
          </p>
          {idleNotice ? (
            <p className="callout-warn mt-4" role="status">
              You were signed out after 60 minutes of inactivity.
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field mt-1"
              />
            </label>
            <p className="text-sm">
              <Link className="link-brand" to="/forgot-password">
                Forgot password?
              </Link>
            </p>
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

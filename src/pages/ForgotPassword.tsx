import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const { error: err } = await requestPasswordReset(email.trim());
    setBusy(false);
    if (err && /fetch|network|failed to/i.test(err.message)) {
      setError(err.message);
      return;
    }
    setInfo(
      "If an account exists for that email, we sent a link to reset your password."
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-paper px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <BrandMark to="/login" />
        <p className="mt-2 text-sm text-muted">
          Track worker visa expiry for your team.
        </p>

        <div className="panel mt-8 p-6">
          <h1 className="page-title">Reset password</h1>
          <p className="page-sub mt-1 text-pretty">
            Enter the email for your manager account.{" "}
            <Link className="link-brand" to="/login">
              Back to sign in
            </Link>
            .
          </p>
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
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

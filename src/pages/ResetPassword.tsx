import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthLoading } from "../components/ProtectedRoute";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";

export function ResetPassword() {
  const { loading, isRecovery, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  if (saved) return <Navigate to="/" replace />;
  if (loading) return <AuthLoading />;
  if (!isRecovery) return <Navigate to="/forgot-password" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-paper px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <BrandMark to="/login" />
        <p className="mt-2 text-sm text-muted">
          Track worker visa expiry for your team.
        </p>

        <div className="panel mt-8 p-6">
          <h1 className="page-title">Choose a new password</h1>
          <p className="page-sub mt-1 text-pretty">
            Use at least 8 characters.{" "}
            <Link className="link-brand" to="/login">
              Back to sign in
            </Link>
            .
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink-soft">
                New password
              </span>
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
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

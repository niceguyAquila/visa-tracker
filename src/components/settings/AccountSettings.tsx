import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export function AccountSettings() {
  const { signOut, user } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setSignOutError(null);
    setBusy(true);
    const { error } = await signOut();
    setBusy(false);
    if (error) setSignOutError(error.message);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Account</h2>
        <p className="page-sub">The account signed in on this device.</p>
      </div>

      <div className="panel space-y-3 p-4">
        <div>
          <p className="meta">Signed in as</p>
          <p className="mt-1 break-all text-sm text-ink">
            {user?.email ?? "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onSignOut()}
          disabled={busy}
          className="btn-danger"
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>

      {signOutError ? (
        <p className="text-sm text-red-700">{signOutError}</p>
      ) : null}
    </div>
  );
}

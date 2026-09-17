import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AppNav } from "./AppNav";
import { BrandMark } from "./BrandMark";
import { SessionIdleGuard } from "./SessionIdleGuard";

export function Layout() {
  const { signOut, user } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function onSignOut() {
    setSignOutError(null);
    const { error } = await signOut();
    if (error) setSignOutError(error.message);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <SessionIdleGuard />
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <BrandMark />
          <div className="hidden min-w-0 flex-1 md:block">
            <AppNav variant="desktop" />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2 text-sm sm:gap-3">
            {user?.email ? (
              <span className="hidden max-w-[28vw] truncate text-muted lg:inline">
                {user.email}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="btn-ghost shrink-0 px-3 py-1.5"
            >
              Sign out
            </button>
          </div>
        </div>
        {signOutError ? (
          <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800">
            {signOutError}
          </p>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 md:pb-8">
        <Outlet />
      </main>

      <AppNav variant="mobile" />
    </div>
  );
}

import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { signOut, user } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-slate-800">
            Visa Tracker
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {user?.email ? (
              <span className="hidden max-w-[40vw] truncate text-slate-500 sm:inline">
                {user.email}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

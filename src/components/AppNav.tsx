import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard", short: "Dash", end: true },
  { to: "/customers", label: "Customers", short: "Customers", end: true },
  { to: "/companies", label: "Companies", short: "Companies", end: true },
  { to: "/visas/active", label: "Visa Active", short: "Active", end: true },
  { to: "/visas/archive", label: "Visa Archive", short: "Archive", end: true },
] as const;

function linkClass(active: boolean) {
  return [
    "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center text-xs font-medium transition-colors sm:min-h-0 sm:flex-none sm:flex-row sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm",
    active
      ? "text-blue-700 sm:bg-blue-50 sm:text-blue-800"
      : "text-slate-500 hover:text-slate-800 sm:hover:bg-slate-50",
  ].join(" ");
}

export function AppNav() {
  return (
    <>
      {/* Desktop / tablet top nav */}
      <nav
        aria-label="Main"
        className="hidden border-b border-slate-200 bg-white sm:block"
      >
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 py-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => linkClass(isActive)}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <div className="mx-auto flex max-w-3xl">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => linkClass(isActive)}
            >
              <span className="max-w-full truncate">{link.short}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}

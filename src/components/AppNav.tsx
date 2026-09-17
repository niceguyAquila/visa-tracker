import { NavLink } from "react-router-dom";
import type { SVGProps } from "react";

const links = [
  { to: "/", label: "Dashboard", short: "Dash", end: true, icon: IconGrid },
  { to: "/customers", label: "Customers", short: "People", end: true, icon: IconPeople },
  { to: "/settings", label: "Settings", short: "Setup", end: true, icon: IconSettings },
  { to: "/visas/active", label: "Visa Active", short: "Active", end: true, icon: IconStamp },
  { to: "/visas/archive", label: "Visa Archive", short: "Archive", end: true, icon: IconArchive },
] as const;

function IconGrid(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </svg>
  );
}

function IconPeople(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 18.5c.6-2.6 2.5-4 5-4s4.4 1.4 5 4" strokeLinecap="round" />
      <circle cx="16.5" cy="9" r="2.2" />
      <path d="M20.5 18.5c-.4-2-1.8-3.2-3.8-3.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 3.5v2M12 18.5v2M4.9 7.05l1.7 1.2M17.4 15.75l1.7 1.2M3.5 12h2M18.5 12h2M4.9 16.95l1.7-1.2M17.4 8.25l1.7-1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconStamp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="11" r="6.5" />
      <path d="M9 11.2l2 2 4.2-4.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 19h12" strokeLinecap="round" />
    </svg>
  );
}

function IconArchive(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="4" y="4" width="16" height="5" rx="1.2" />
      <path d="M6 9v9.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V9" />
      <path d="M10 13h4" strokeLinecap="round" />
    </svg>
  );
}

function desktopLinkClass(active: boolean) {
  return [
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-brand-soft text-brand-ink"
      : "text-muted hover:bg-paper hover:text-ink",
  ].join(" ");
}

function mobileLinkClass(active: boolean) {
  return [
    "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center text-[0.7rem] font-medium transition-colors",
    active ? "text-brand" : "text-muted hover:text-ink",
  ].join(" ");
}

export function AppNav({ variant }: { variant: "desktop" | "mobile" }) {
  if (variant === "desktop") {
    return (
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => desktopLinkClass(isActive)}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-7xl">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => mobileLinkClass(isActive)}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="max-w-full truncate">{link.short}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

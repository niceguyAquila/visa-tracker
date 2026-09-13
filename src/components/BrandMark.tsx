import { Link } from "react-router-dom";

export function StampMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle
        cx="16"
        cy="16"
        r="14.25"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <circle
        cx="16"
        cy="16"
        r="12.15"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeDasharray="2.1 1.55"
      />
      <path
        d="M10.4 16.3l3.7 3.7 7.5-8.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandMark({ to = "/" }: { to?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-w-0 items-center gap-2 text-brand"
    >
      <StampMark className="size-8 shrink-0" />
      <span className="truncate text-lg font-semibold tracking-tight text-ink">
        Mission: Approved
      </span>
    </Link>
  );
}

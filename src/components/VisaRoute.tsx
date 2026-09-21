import type { SVGProps } from "react";
import { Link } from "react-router-dom";
import { FieldLabel, inputClass } from "./forms/formStyles";

function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M5 12h12M13 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M12 5v12M7 13l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RouteConnector({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`flex items-center justify-center text-muted ${
        compact
          ? "px-2 py-1 sm:min-w-[5rem] sm:flex-1 sm:px-4 sm:py-0"
          : "py-1 sm:h-[42px] sm:px-2 sm:py-0"
      }`}
      aria-hidden="true"
    >
      <span className="hidden w-full items-center sm:flex">
        <span className="h-px min-w-3 flex-1 bg-line-strong" />
        <ArrowRightIcon className="size-4 shrink-0" />
      </span>
      <span className="flex flex-col items-center sm:hidden">
        <span className="h-2 w-px bg-line-strong" />
        <ArrowDownIcon className="size-4" />
      </span>
    </span>
  );
}

function RouteStop({
  label,
  value,
  align = "start",
}: {
  label: string;
  value: string;
  align?: "start" | "end";
}) {
  const empty = !value;
  return (
    <div className={`min-w-0 ${align === "end" ? "sm:text-right" : ""}`}>
      <p className="meta">{label}</p>
      <p
        className={`mt-1 truncate text-sm font-medium ${
          empty ? "text-muted" : "text-ink"
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

export function VisaRouteDisplay({
  route,
  exitRoute,
}: {
  route: string;
  exitRoute: string;
}) {
  return (
    <div
      className="flex flex-col rounded-lg border border-line bg-paper px-3 py-3 sm:flex-row sm:items-center"
      aria-label="Route"
    >
      <RouteStop label="Entry" value={route} />
      <RouteConnector compact />
      <RouteStop label="Exit" value={exitRoute} align="end" />
    </div>
  );
}

export function VisaRouteFields({
  route,
  exitRoute,
  portOptions,
  onRouteChange,
  onExitRouteChange,
}: {
  route: string;
  exitRoute: string;
  portOptions: string[];
  onRouteChange: (next: string) => void;
  onExitRouteChange: (next: string) => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-3">
      <p className="meta">Route</p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
        <label className="block min-w-0">
          <FieldLabel>Entry</FieldLabel>
          <select
            value={route}
            onChange={(e) => onRouteChange(e.target.value)}
            className={inputClass}
            aria-label="Entry route"
          >
            <option value="">Select…</option>
            {portOptions.map((port) => (
              <option key={`in-${port}`} value={port}>
                {port}
              </option>
            ))}
          </select>
        </label>
        <RouteConnector />
        <label className="block min-w-0">
          <FieldLabel>Exit</FieldLabel>
          <select
            value={exitRoute}
            onChange={(e) => onExitRouteChange(e.target.value)}
            className={inputClass}
            aria-label="Exit route"
          >
            <option value="">Select…</option>
            {portOptions.map((port) => (
              <option key={`out-${port}`} value={port}>
                {port}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">
        Need another?{" "}
        <Link to="/settings#ports" className="link-brand">
          Manage ports
        </Link>
      </p>
    </div>
  );
}

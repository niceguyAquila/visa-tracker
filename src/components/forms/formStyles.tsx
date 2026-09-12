import type { ReactNode } from "react";

export const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

export const inputErrorClass =
  "mt-1 w-full rounded-lg border border-red-300 px-3 py-2 text-base focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200";

export const readOnlyClass =
  "mt-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800";

export function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="text-sm font-medium text-slate-700">
      {children}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
    </span>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function SectionHeading({
  step,
  title,
  hint,
}: {
  step?: number;
  title: string;
  hint?: ReactNode;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        {step != null ? (
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
            {step}
          </span>
        ) : null}
        {title}
      </h2>
      {hint ? <div className="mt-0.5 text-sm text-slate-600">{hint}</div> : null}
    </div>
  );
}

/** Visual wrapper that separates major form blocks more clearly. */
export function FormSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

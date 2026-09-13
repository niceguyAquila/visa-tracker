import type { ReactNode } from "react";

export const inputClass = "input-field mt-1";

export const inputErrorClass = "input-field-error mt-1";

export const readOnlyClass =
  "mt-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink";

export function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="text-sm font-medium text-ink-soft">
      {children}
      {required ? <span className="ml-0.5 text-red-600">*</span> : null}
    </span>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-700">{message}</p>;
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
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        {step != null ? (
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink">
            {step}
          </span>
        ) : null}
        {title}
      </h2>
      {hint ? <div className="mt-0.5 text-sm text-muted">{hint}</div> : null}
    </div>
  );
}

/** Visual wrapper that separates major form blocks like a paper application. */
export function FormSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-4 border-t border-line pt-5 first:border-t-0 first:pt-0 ${className}`}>
      {children}
    </section>
  );
}

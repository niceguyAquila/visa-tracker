import {
  companyChipClass,
  companySwatchClass,
} from "../lib/companyColor";

export function CompanyChip({
  name,
  color,
  className = "",
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-medium ${companyChipClass(color)} ${className}`}
    >
      <span
        className={`size-2 shrink-0 rounded-full ${companySwatchClass(color)}`}
        aria-hidden="true"
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function CompanySwatch({
  color,
  className = "",
}: {
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`inline-block size-3 shrink-0 rounded-full ${companySwatchClass(color)} ${className}`}
      aria-hidden="true"
    />
  );
}

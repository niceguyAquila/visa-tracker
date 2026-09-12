export const COMPANY_COLORS = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "pink",
  "rose",
  "slate",
] as const;

export type CompanyColorName = (typeof COMPANY_COLORS)[number];

const LABELS: Record<CompanyColorName, string> = {
  red: "Red",
  orange: "Orange",
  amber: "Amber",
  yellow: "Yellow",
  lime: "Lime",
  green: "Green",
  teal: "Teal",
  cyan: "Cyan",
  blue: "Blue",
  indigo: "Indigo",
  violet: "Violet",
  pink: "Pink",
  rose: "Rose",
  slate: "Slate",
};

const CHIP_CLASSES: Record<CompanyColorName, string> = {
  red: "bg-red-100 text-red-900",
  orange: "bg-orange-100 text-orange-900",
  amber: "bg-amber-100 text-amber-900",
  yellow: "bg-yellow-100 text-yellow-900",
  lime: "bg-lime-100 text-lime-900",
  green: "bg-green-100 text-green-900",
  teal: "bg-teal-100 text-teal-900",
  cyan: "bg-cyan-100 text-cyan-900",
  blue: "bg-blue-100 text-blue-900",
  indigo: "bg-indigo-100 text-indigo-900",
  violet: "bg-violet-100 text-violet-900",
  pink: "bg-pink-100 text-pink-900",
  rose: "bg-rose-100 text-rose-900",
  slate: "bg-slate-100 text-slate-800",
};

const SWATCH_CLASSES: Record<CompanyColorName, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-400",
  lime: "bg-lime-500",
  green: "bg-green-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

export function isCompanyColor(value: string | null | undefined): value is CompanyColorName {
  return (
    typeof value === "string" &&
    (COMPANY_COLORS as readonly string[]).includes(value)
  );
}

export function companyColorLabel(color: string | null | undefined): string {
  if (!isCompanyColor(color)) return "None";
  return LABELS[color];
}

export function companyChipClass(color: string | null | undefined): string {
  if (!isCompanyColor(color)) return "bg-slate-100 text-slate-700";
  return CHIP_CLASSES[color];
}

export function companySwatchClass(color: string | null | undefined): string {
  if (!isCompanyColor(color)) return "bg-slate-300";
  return SWATCH_CLASSES[color];
}

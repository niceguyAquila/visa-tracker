export type CountryDial = {
  code: string;
  label: string;
  /** Max local digits (without country code / leading 0) */
  maxLocal: number;
  /** Min local digits */
  minLocal: number;
};

/** Common SEA / nearby dial codes for this app */
export const COUNTRY_DIALS: CountryDial[] = [
  { code: "+62", label: "Indonesia (+62)", maxLocal: 12, minLocal: 8 },
  { code: "+61", label: "Australia (+61)", maxLocal: 9, minLocal: 9 },
  { code: "+60", label: "Malaysia (+60)", maxLocal: 10, minLocal: 8 },
  { code: "+65", label: "Singapore (+65)", maxLocal: 8, minLocal: 8 },
  { code: "+63", label: "Philippines (+63)", maxLocal: 10, minLocal: 10 },
  { code: "+66", label: "Thailand (+66)", maxLocal: 9, minLocal: 9 },
];

export const DEFAULT_DIAL = COUNTRY_DIALS[0]!;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Strip a single leading trunk 0 from local numbers (e.g. 0812 → 812). */
export function normalizeLocalDigits(local: string): string {
  const d = digitsOnly(local);
  return d.startsWith("0") ? d.slice(1) : d;
}

export function formatLocalDisplay(local: string): string {
  return digitsOnly(local);
}

export function composePhone(dialCode: string, local: string): string {
  const localDigits = normalizeLocalDigits(local);
  if (!localDigits) return "";
  return `${dialCode}${localDigits}`;
}

export function parseStoredPhone(stored: string): {
  dialCode: string;
  local: string;
} {
  const trimmed = stored.trim();
  if (!trimmed) {
    return { dialCode: DEFAULT_DIAL.code, local: "" };
  }

  const match = COUNTRY_DIALS.find((d) => trimmed.startsWith(d.code));
  if (match) {
    return {
      dialCode: match.code,
      local: digitsOnly(trimmed.slice(match.code.length)),
    };
  }

  // Stored without + / unknown code — treat whole thing as local under default dial
  if (trimmed.startsWith("+")) {
    const digits = digitsOnly(trimmed);
    return { dialCode: DEFAULT_DIAL.code, local: digits };
  }

  return {
    dialCode: DEFAULT_DIAL.code,
    local: normalizeLocalDigits(trimmed),
  };
}

export function validatePhone(
  dialCode: string,
  local: string
): string | null {
  const dial = COUNTRY_DIALS.find((d) => d.code === dialCode) ?? DEFAULT_DIAL;
  const localDigits = normalizeLocalDigits(local);

  if (!localDigits) {
    return null;
  }
  if (localDigits.length < dial.minLocal) {
    return `Phone number is too short for ${dial.code} (min ${dial.minLocal} digits).`;
  }
  if (localDigits.length > dial.maxLocal) {
    return `Phone number is too long for ${dial.code} (max ${dial.maxLocal} digits).`;
  }
  return null;
}

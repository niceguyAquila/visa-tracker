import type { Passport } from "../../types";
import { sortPassports } from "../../lib/customer";
import { formatDisplayDate } from "../../lib/dates";
import { FieldError, FieldLabel, inputClass, inputErrorClass } from "./formStyles";

type PassportSelectProps = {
  passports: Passport[];
  passportId: string;
  onChange: (id: string) => void;
  error?: string;
  disabled?: boolean;
};

export function PassportSelect({
  passports,
  passportId,
  onChange,
  error,
  disabled = false,
}: PassportSelectProps) {
  const sorted = sortPassports(passports);

  return (
    <label className="block">
      <FieldLabel required>Passport</FieldLabel>
      {sorted.length === 0 ? (
        <p className="mt-1 text-sm text-muted">
          This customer has no passports yet.
        </p>
      ) : (
        <select
          required
          disabled={disabled}
          value={passportId}
          onChange={(e) => onChange(e.target.value)}
          className={error ? inputErrorClass : inputClass}
          aria-invalid={Boolean(error)}
        >
          <option value="">Select a passport…</option>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.passport_number}
              {p.is_current ? " (current)" : ""}
              {` · exp ${formatDisplayDate(p.passport_expiry)}`}
            </option>
          ))}
        </select>
      )}
      <FieldError message={error} />
    </label>
  );
}

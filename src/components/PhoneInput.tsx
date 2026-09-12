import { COUNTRY_DIALS, DEFAULT_DIAL, formatLocalDisplay } from "../lib/phone";

type PhoneInputProps = {
  dialCode: string;
  localNumber: string;
  onDialCodeChange: (code: string) => void;
  onLocalNumberChange: (local: string) => void;
  required?: boolean;
  id?: string;
};

export function PhoneInput({
  dialCode,
  localNumber,
  onDialCodeChange,
  onLocalNumberChange,
  required,
  id,
}: PhoneInputProps) {
  const dial = COUNTRY_DIALS.find((d) => d.code === dialCode) ?? DEFAULT_DIAL;

  return (
    <div className="mt-1 flex gap-2">
      <select
        aria-label="Country code"
        value={dialCode}
        onChange={(e) => onDialCodeChange(e.target.value)}
        className="w-[9.5rem] shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-44"
      >
        {COUNTRY_DIALS.map((d) => (
          <option key={d.code} value={d.code}>
            {d.label}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required={required}
        placeholder="8123456789"
        value={localNumber}
        maxLength={dial.maxLocal + 1}
        onChange={(e) => onLocalNumberChange(formatLocalDisplay(e.target.value))}
        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  );
}

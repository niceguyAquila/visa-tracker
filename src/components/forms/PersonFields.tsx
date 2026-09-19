import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PhoneInput } from "../PhoneInput";
import type { Company } from "../../types";
import {
  FieldError,
  FieldLabel,
  inputClass,
  inputErrorClass,
} from "./formStyles";

export type PersonFieldsValue = {
  fullName: string;
  companyId: string;
  passportNumber: string;
  passportExpiry: string;
  visaCount: number;
  extensionCount: number;
  dialCode: string;
  localNumber: string;
};

export type PersonFieldErrors = Partial<
  Record<
    | "fullName"
    | "companyId"
    | "passportNumber"
    | "passportExpiry"
    | "localNumber",
    string
  >
>;

type PersonFieldsProps = {
  value: PersonFieldsValue;
  companies: Company[];
  onChange: (patch: Partial<PersonFieldsValue>) => void;
  errors?: PersonFieldErrors;
  blocked?: boolean;
  showPassport?: boolean;
};

export function PersonFields({
  value,
  companies,
  onChange,
  errors = {},
  blocked = false,
  showPassport = true,
}: PersonFieldsProps) {
  const [historyOpen, setHistoryOpen] = useState(
    value.visaCount > 0 || value.extensionCount > 0
  );

  useEffect(() => {
    if (value.visaCount > 0 || value.extensionCount > 0) {
      setHistoryOpen(true);
    }
  }, [value.visaCount, value.extensionCount]);

  return (
    <div className={`space-y-5 ${blocked ? "pointer-events-none opacity-50" : ""}`}>
      <div className="space-y-4">
        <p className="meta">
          Identity
        </p>
        <label className="block">
          <FieldLabel required>Name</FieldLabel>
          <input
            required
            value={value.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            className={errors.fullName ? inputErrorClass : inputClass}
            aria-invalid={Boolean(errors.fullName)}
          />
          <FieldError message={errors.fullName} />
        </label>

        <label className="block">
          <FieldLabel required>Company</FieldLabel>
          {companies.length === 0 ? (
            <p className="mt-1 text-sm text-muted">
              No companies yet.{" "}
              <Link
                to="/settings"
                className="link-brand"
              >
                Create a company
              </Link>{" "}
              before adding a customer.
            </p>
          ) : (
            <select
              required
              value={value.companyId}
              onChange={(e) => onChange({ companyId: e.target.value })}
              className={errors.companyId ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.companyId)}
            >
              <option value="">Select a company…</option>
              {companies.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
          )}
          <FieldError message={errors.companyId} />
          {companies.length > 0 ? (
            <p className="mt-1 text-xs text-muted">
              Need another?{" "}
              <Link to="/settings" className="link-brand">
                Manage companies
              </Link>
            </p>
          ) : null}
        </label>

        <div>
          <FieldLabel>Contact number</FieldLabel>
          <PhoneInput
            dialCode={value.dialCode}
            localNumber={value.localNumber}
            onDialCodeChange={(dialCode) => onChange({ dialCode })}
            onLocalNumberChange={(localNumber) => onChange({ localNumber })}
          />
          <FieldError message={errors.localNumber} />
        </div>
      </div>

      {showPassport ? (
        <div className="space-y-4 border-t border-line pt-5">
          <p className="meta">
            Passport
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel required>Passport number</FieldLabel>
              <input
                required
                value={value.passportNumber}
                onChange={(e) => onChange({ passportNumber: e.target.value })}
                className={errors.passportNumber ? inputErrorClass : inputClass}
                aria-invalid={Boolean(errors.passportNumber)}
              />
              <FieldError message={errors.passportNumber} />
            </label>
            <label className="block">
              <FieldLabel required>Passport expiry</FieldLabel>
              <input
                type="date"
                required
                value={value.passportExpiry}
                onChange={(e) => onChange({ passportExpiry: e.target.value })}
                className={errors.passportExpiry ? inputErrorClass : inputClass}
                aria-invalid={Boolean(errors.passportExpiry)}
              />
              <FieldError message={errors.passportExpiry} />
            </label>
          </div>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-line pt-5">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="link-brand text-sm"
        >
          {historyOpen ? "Hide history counts" : "History counts (optional)"}
        </button>
        {historyOpen ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Visa count</FieldLabel>
              <input
                type="number"
                min={0}
                step={1}
                value={value.visaCount}
                onChange={(e) => onChange({ visaCount: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel>Extension count</FieldLabel>
              <input
                type="number"
                min={0}
                step={1}
                value={value.extensionCount}
                onChange={(e) =>
                  onChange({ extensionCount: Number(e.target.value) })
                }
                className={inputClass}
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}

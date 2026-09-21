import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PhoneInput } from "../PhoneInput";
import {
  CUSTOMER_STATUS_OPTIONS,
  DEFAULT_CUSTOMER_STATUS,
} from "../../lib/customer";
import { customerStatusSegmentActiveClass } from "../../lib/ui";
import type { Company, CustomerStatus } from "../../types";
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
  status: CustomerStatus;
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

        <div>
          <FieldLabel>Status</FieldLabel>
          <div
            role="radiogroup"
            aria-label="Customer status"
            className="mt-1 flex flex-col gap-1 rounded-lg border border-line bg-paper p-1 sm:flex-row"
          >
            {CUSTOMER_STATUS_OPTIONS.map((opt) => {
              const active = (value.status ?? DEFAULT_CUSTOMER_STATUS) === opt;
              const base =
                "flex-1 rounded-md px-2 py-2 text-center text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";
              return (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange({ status: opt })}
                  className={
                    active
                      ? `${base} ${customerStatusSegmentActiveClass(opt)}`
                      : `${base} text-muted hover:bg-surface hover:text-ink`
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted">
            Currently Not Working people stay in the list, but are not counted
            in Dashboard Customers.
          </p>
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

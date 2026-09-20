import type { EVisaFieldErrors, EVisaFieldsValue } from "../../lib/evisa";
import { EVISA_GENDER_OPTIONS } from "../../lib/evisa";
import {
  FieldError,
  FieldLabel,
  inputClass,
  inputErrorClass,
} from "./formStyles";

type EVisaFieldsProps = {
  value: EVisaFieldsValue;
  onChange: (patch: Partial<EVisaFieldsValue>) => void;
  errors?: EVisaFieldErrors;
};

export function EVisaFields({
  value,
  onChange,
  errors = {},
}: EVisaFieldsProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="meta">e-Visa</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel required>eVISA number</FieldLabel>
            <input
              required
              value={value.evisaNumber}
              onChange={(e) => onChange({ evisaNumber: e.target.value })}
              className={errors.evisaNumber ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.evisaNumber)}
            />
            <FieldError message={errors.evisaNumber} />
          </label>
          <label className="block">
            <FieldLabel>Ref. number</FieldLabel>
            <input
              value={value.refNumber}
              onChange={(e) => onChange({ refNumber: e.target.value })}
              className={errors.refNumber ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.refNumber)}
            />
            <FieldError message={errors.refNumber} />
          </label>
          <label className="block">
            <FieldLabel required>eVISA issue date</FieldLabel>
            <input
              required
              type="date"
              value={value.issueDate}
              onChange={(e) => onChange({ issueDate: e.target.value })}
              className={errors.issueDate ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.issueDate)}
            />
            <FieldError message={errors.issueDate} />
          </label>
          <label className="block">
            <FieldLabel required>eVISA expire date</FieldLabel>
            <input
              required
              type="date"
              value={value.expireDate}
              onChange={(e) => onChange({ expireDate: e.target.value })}
              className={errors.expireDate ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.expireDate)}
            />
            <FieldError message={errors.expireDate} />
          </label>
          <label className="block">
            <FieldLabel>Place of issue</FieldLabel>
            <input
              value={value.placeOfIssue}
              onChange={(e) => onChange({ placeOfIssue: e.target.value })}
              className={errors.placeOfIssue ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.placeOfIssue)}
            />
            <FieldError message={errors.placeOfIssue} />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Remarks</FieldLabel>
            <textarea
              rows={3}
              value={value.remarks}
              onChange={(e) => onChange({ remarks: e.target.value })}
              className={errors.remarks ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.remarks)}
            />
            <FieldError message={errors.remarks} />
          </label>
        </div>
      </div>

      <div>
        <p className="meta">Person on document</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Gender</FieldLabel>
            <select
              value={value.gender}
              onChange={(e) => onChange({ gender: e.target.value })}
              className={errors.gender ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.gender)}
            >
              <option value="">Select…</option>
              {EVISA_GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <FieldError message={errors.gender} />
          </label>
          <label className="block">
            <FieldLabel required>Full name</FieldLabel>
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
            <FieldLabel>Date of birth</FieldLabel>
            <input
              type="date"
              value={value.dateOfBirth}
              onChange={(e) => onChange({ dateOfBirth: e.target.value })}
              className={errors.dateOfBirth ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.dateOfBirth)}
            />
            <FieldError message={errors.dateOfBirth} />
          </label>
          <label className="block">
            <FieldLabel>Nationality</FieldLabel>
            <input
              value={value.nationality}
              onChange={(e) => onChange({ nationality: e.target.value })}
              className={errors.nationality ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.nationality)}
            />
            <FieldError message={errors.nationality} />
          </label>
        </div>
      </div>

      <div>
        <p className="meta">Travel document</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel required>Travel document</FieldLabel>
            <input
              required
              value={value.travelDocument}
              onChange={(e) => onChange({ travelDocument: e.target.value })}
              className={errors.travelDocument ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.travelDocument)}
            />
            <FieldError message={errors.travelDocument} />
          </label>
          <label className="block">
            <FieldLabel required>Travel doc. no</FieldLabel>
            <input
              required
              value={value.travelDocNo}
              onChange={(e) => onChange({ travelDocNo: e.target.value })}
              className={errors.travelDocNo ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.travelDocNo)}
            />
            <FieldError message={errors.travelDocNo} />
          </label>
          <label className="block">
            <FieldLabel>Travel doc. issue</FieldLabel>
            <input
              type="date"
              value={value.travelDocIssue}
              onChange={(e) => onChange({ travelDocIssue: e.target.value })}
              className={errors.travelDocIssue ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.travelDocIssue)}
            />
            <FieldError message={errors.travelDocIssue} />
          </label>
          <label className="block">
            <FieldLabel>Travel doc. expiry</FieldLabel>
            <input
              type="date"
              value={value.travelDocExpiry}
              onChange={(e) => onChange({ travelDocExpiry: e.target.value })}
              className={errors.travelDocExpiry ? inputErrorClass : inputClass}
              aria-invalid={Boolean(errors.travelDocExpiry)}
            />
            <FieldError message={errors.travelDocExpiry} />
          </label>
        </div>
      </div>
    </div>
  );
}

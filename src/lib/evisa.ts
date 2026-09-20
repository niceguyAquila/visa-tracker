import type { EVisa, Passport } from "../types";

export const DEFAULT_TRAVEL_DOCUMENT = "Passport";

export const EVISA_GENDER_OPTIONS = ["Male", "Female"] as const;

export const EVISA_EMBED = "e_visas!visa_id (*)";

export type EVisaFieldsValue = {
  evisaNumber: string;
  refNumber: string;
  issueDate: string;
  expireDate: string;
  placeOfIssue: string;
  remarks: string;
  gender: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  travelDocument: string;
  travelDocNo: string;
  travelDocIssue: string;
  travelDocExpiry: string;
};

export type EVisaFieldErrors = Partial<
  Record<keyof EVisaFieldsValue | "passportId", string>
>;

export function emptyEVisaFields(): EVisaFieldsValue {
  return {
    evisaNumber: "",
    refNumber: "",
    issueDate: "",
    expireDate: "",
    placeOfIssue: "",
    remarks: "",
    gender: "",
    fullName: "",
    dateOfBirth: "",
    nationality: "",
    travelDocument: DEFAULT_TRAVEL_DOCUMENT,
    travelDocNo: "",
    travelDocIssue: "",
    travelDocExpiry: "",
  };
}

export function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function evisaNumberOf(
  value:
    | { evisa_number: string }
    | { evisa_number: string }[]
    | null
    | undefined
): string | null {
  return embedOne(value)?.evisa_number ?? null;
}

export function evisaFromRow(row: EVisa): EVisaFieldsValue {
  return {
    evisaNumber: row.evisa_number,
    refNumber: row.ref_number,
    issueDate: row.issue_date,
    expireDate: row.expire_date,
    placeOfIssue: row.place_of_issue,
    remarks: row.remarks,
    gender: row.gender,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth ?? "",
    nationality: row.nationality,
    travelDocument: row.travel_document,
    travelDocNo: row.travel_doc_no,
    travelDocIssue: row.travel_doc_issue ?? "",
    travelDocExpiry: row.travel_doc_expiry ?? "",
  };
}

export function snapshotFromPassport(
  prev: EVisaFieldsValue,
  passport: Pick<Passport, "passport_number" | "passport_expiry"> | null,
  customerName: string
): Partial<EVisaFieldsValue> {
  const patch: Partial<EVisaFieldsValue> = {};
  if (passport) {
    patch.travelDocNo = passport.passport_number;
    patch.travelDocExpiry = passport.passport_expiry;
  }
  const name = customerName.trim();
  if (name && (!prev.fullName.trim() || prev.fullName.trim() === name)) {
    patch.fullName = name;
  }
  return patch;
}

export function validateEVisaFields(
  value: EVisaFieldsValue,
  passportId: string
): EVisaFieldErrors {
  const next: EVisaFieldErrors = {};
  if (!passportId) next.passportId = "Select a passport.";
  if (!value.evisaNumber.trim()) {
    next.evisaNumber = "eVISA number is required.";
  }
  if (!value.issueDate) next.issueDate = "Issue date is required.";
  if (!value.expireDate) next.expireDate = "Expire date is required.";
  if (
    value.issueDate &&
    value.expireDate &&
    value.expireDate < value.issueDate
  ) {
    next.expireDate = "Expire date must be on or after issue date.";
  }
  if (!value.fullName.trim()) next.fullName = "Full name is required.";
  if (!value.travelDocument.trim()) {
    next.travelDocument = "Travel document is required.";
  }
  if (!value.travelDocNo.trim()) {
    next.travelDocNo = "Travel document number is required.";
  }
  return next;
}

export function evisaPayload(
  orgId: string,
  visaId: string,
  passportId: string,
  value: EVisaFieldsValue
) {
  return {
    org_id: orgId,
    visa_id: visaId,
    passport_id: passportId,
    evisa_number: value.evisaNumber.trim(),
    ref_number: value.refNumber.trim(),
    issue_date: value.issueDate,
    expire_date: value.expireDate,
    place_of_issue: value.placeOfIssue.trim(),
    remarks: value.remarks.trim(),
    gender: value.gender,
    full_name: value.fullName.trim(),
    date_of_birth: value.dateOfBirth || null,
    nationality: value.nationality.trim(),
    travel_document: value.travelDocument.trim(),
    travel_doc_no: value.travelDocNo.trim(),
    travel_doc_issue: value.travelDocIssue || null,
    travel_doc_expiry: value.travelDocExpiry || null,
  };
}

export function evisaUpdatePayload(
  passportId: string,
  value: EVisaFieldsValue
) {
  const payload = evisaPayload("", "", passportId, value);
  return {
    passport_id: payload.passport_id,
    evisa_number: payload.evisa_number,
    ref_number: payload.ref_number,
    issue_date: payload.issue_date,
    expire_date: payload.expire_date,
    place_of_issue: payload.place_of_issue,
    remarks: payload.remarks,
    gender: payload.gender,
    full_name: payload.full_name,
    date_of_birth: payload.date_of_birth,
    nationality: payload.nationality,
    travel_document: payload.travel_document,
    travel_doc_no: payload.travel_doc_no,
    travel_doc_issue: payload.travel_doc_issue,
    travel_doc_expiry: payload.travel_doc_expiry,
  };
}

export function friendlyEvisaConflict(message: string): string {
  if (/e_visas_org_id_lower_number/i.test(message)) {
    return "That eVISA number is already recorded.";
  }
  if (/e_visas_visa_id/i.test(message)) {
    return "This visa already has an e-visa.";
  }
  if (/unique|duplicate/i.test(message)) {
    return "That eVISA number is already recorded.";
  }
  return message;
}

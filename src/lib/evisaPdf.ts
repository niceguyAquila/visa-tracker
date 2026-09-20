import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { EVisaFileMeta, EVisaFieldsValue } from "./evisa";
import { EVISA_GENDER_OPTIONS } from "./evisa";
import { supabase } from "./supabase";

GlobalWorkerOptions.workerSrc = workerSrc;

const FIELD_PATTERNS: Record<string, RegExp[]> = {
  "eVISA Number": [/eVISA\s+Number\s*[:\-]?\s*(.+)/i],
  "Ref. Number": [
    /Ref\.?\s*Number\s*[:\-]?\s*(.+)/i,
    /Reference\s+Number\s*[:\-]?\s*(.+)/i,
  ],
  "eVISA Issue Date": [/eVISA\s+Issue\s+Date\s*[:\-]?\s*(.+)/i],
  "eVISA Expire Date": [/eVISA\s+Expir[ey]\s+Date\s*[:\-]?\s*(.+)/i],
  "Place of Issue": [/Place\s+of\s+Issue\s*[:\-]?\s*(.+)/i],
  "Remarks": [/Remarks\s*[:\-]?\s*(.+)/i],
  Gender: [/Gender\s*[:\-]?\s*(.+)/i, /Sex\s*[:\-]?\s*(.+)/i],
  "Full Name": [/Full\s+Name\s*[:\-]?\s*(.+)/i],
  "Date Of Birth": [/Date\s+[Oo]f\s+Birth\s*[:\-]?\s*(.+)/i],
  Nationality: [/Nationality\s*[:\-]?\s*(.+)/i],
  "Travel Document": [
    /Travel\s+Document\s*[:\-]?\s*(?!No\.?\b|Issue\b|Expir[ey]\b)(.+)/i,
  ],
  "Travel Doc. No": [
    /Travel\s+Doc\.?\s*No\.?\s*[:\-]?\s*(.+)/i,
    /Travel\s+Document\s+No\.?\s*[:\-]?\s*(.+)/i,
  ],
  "Travel Doc. Issue": [
    /Travel\s+Doc\.?\s*Issue\s*[:\-]?\s*(.+)/i,
    /Travel\s+Document\s+Issue\s*[:\-]?\s*(.+)/i,
  ],
  "Travel Doc. Expiry": [
    /Travel\s+Doc\.?\s*Expir[ey]\s*[:\-]?\s*(.+)/i,
    /Travel\s+Document\s+Expir[ey]\s*[:\-]?\s*(.+)/i,
  ],
};

const FIELD_LABELS = Object.keys(FIELD_PATTERNS);

const LABEL_ALIASES: Record<string, string> = {
  "evisa number": "eVISA Number",
  "ref. number": "Ref. Number",
  "ref number": "Ref. Number",
  "reference number": "Ref. Number",
  "evisa issue date": "eVISA Issue Date",
  "evisa expire date": "eVISA Expire Date",
  "evisa expiry date": "eVISA Expire Date",
  "place of issue": "Place of Issue",
  remarks: "Remarks",
  gender: "Gender",
  sex: "Gender",
  "full name": "Full Name",
  "date of birth": "Date Of Birth",
  nationality: "Nationality",
  "travel document": "Travel Document",
  "travel doc. no": "Travel Doc. No",
  "travel doc no": "Travel Doc. No",
  "travel document no": "Travel Doc. No",
  "travel doc. issue": "Travel Doc. Issue",
  "travel doc issue": "Travel Doc. Issue",
  "travel document issue": "Travel Doc. Issue",
  "travel doc. expiry": "Travel Doc. Expiry",
  "travel doc expiry": "Travel Doc. Expiry",
  "travel document expiry": "Travel Doc. Expiry",
  "travel doc. expire": "Travel Doc. Expiry",
};

const LINE_Y_TOL = 5;
const VALUE_MAX_X = 400;

type PdfTextItem = {
  str: string;
  x: number;
  y: number;
};

export const EVISA_BUCKET = "e-visas";
export const EVISA_PDF_MAX_BYTES = 10 * 1024 * 1024;

function normalizeLabelKey(raw: string): string {
  return raw
    .replace(/[:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function canonicalField(raw: string): string | null {
  return LABEL_ALIASES[normalizeLabelKey(raw)] ?? null;
}

function cleanValue(raw: string): string {
  let value = raw.trim();
  const labelsByLength = [...FIELD_LABELS].sort((a, b) => b.length - a.length);
  for (const label of labelsByLength) {
    if (value.toLowerCase() === label.toLowerCase()) return "";
    const prefix = new RegExp(
      `^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-]?\\s*`,
      "i"
    );
    value = value.replace(prefix, "").trim();
  }
  for (const label of labelsByLength) {
    const idx = value.toLowerCase().indexOf(label.toLowerCase());
    if (idx > 0) value = value.slice(0, idx).trim();
  }
  return value.replace(/^[\s|:.\-]+|[\s|:.\-]+$/g, "");
}

function emptyFieldMap(): Record<string, string> {
  return Object.fromEntries(FIELD_LABELS.map((label) => [label, ""]));
}

function extractFieldsFromLines(text: string): Record<string, string> {
  const results = emptyFieldMap();
  for (const [fieldName, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = cleanValue(match[1].split("\n")[0] ?? "");
        if (value && !canonicalField(value)) {
          results[fieldName] = value;
          break;
        }
      }
    }
  }
  return results;
}

function itemsToText(items: PdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; parts: PdfTextItem[] }[] = [];
  for (const item of sorted) {
    const line = lines.find((row) => Math.abs(row.y - item.y) <= LINE_Y_TOL);
    if (line) {
      line.parts.push(item);
      line.y =
        (line.y * (line.parts.length - 1) + item.y) / line.parts.length;
    } else {
      lines.push({ y: item.y, parts: [item] });
    }
  }
  return lines
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.str)
        .join(" ")
    )
    .join("\n");
}

function extractFieldsFromLayout(items: PdfTextItem[]): Record<string, string> {
  const results = emptyFieldMap();
  for (const item of items) {
    const field = canonicalField(item.str);
    if (!field || results[field]) continue;
    const value = cleanValue(
      items
        .filter(
          (other) =>
            other !== item &&
            Math.abs(other.y - item.y) <= LINE_Y_TOL &&
            other.x > item.x + 8 &&
            other.x < VALUE_MAX_X
        )
        .sort((a, b) => a.x - b.x)
        .map((other) => other.str)
        .join(" ")
    );
    if (value && !canonicalField(value)) results[field] = value;
  }
  return results;
}

function mergeFieldMaps(
  primary: Record<string, string>,
  fallback: Record<string, string>
): Record<string, string> {
  const results = emptyFieldMap();
  for (const label of FIELD_LABELS) {
    results[label] = primary[label] || fallback[label] || "";
  }
  return results;
}

function toIsoDate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/.\\-](\d{1,2})[/.\\-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return "";
}

function toGender(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (!key) return "";
  if (key.startsWith("m")) return "Male";
  if (key.startsWith("f")) return "Female";
  return EVISA_GENDER_OPTIONS.includes(raw as (typeof EVISA_GENDER_OPTIONS)[number])
    ? raw
    : "";
}

export async function extractPdfItems(file: File): Promise<PdfTextItem[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const items: PdfTextItem[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      items.push({
        str: item.str.replace(/\s+/g, " ").trim(),
        x,
        y,
      });
    }
  }
  return items;
}

export async function extractPdfText(file: File): Promise<string> {
  return itemsToText(await extractPdfItems(file));
}

export function nonEmptyEvisaFields(
  patch: Partial<EVisaFieldsValue>
): Partial<EVisaFieldsValue> {
  const next: Partial<EVisaFieldsValue> = {};
  for (const [key, value] of Object.entries(patch) as [
    keyof EVisaFieldsValue,
    string | undefined,
  ][]) {
    if (typeof value === "string" && value.trim()) next[key] = value;
  }
  return next;
}

function fieldsFromRaw(raw: Record<string, string>): Partial<EVisaFieldsValue> {
  return nonEmptyEvisaFields({
    evisaNumber: raw["eVISA Number"] ?? "",
    refNumber: raw["Ref. Number"] ?? "",
    issueDate: toIsoDate(raw["eVISA Issue Date"] ?? ""),
    expireDate: toIsoDate(raw["eVISA Expire Date"] ?? ""),
    placeOfIssue: raw["Place of Issue"] ?? "",
    remarks: raw["Remarks"] ?? "",
    gender: toGender(raw.Gender ?? ""),
    fullName: raw["Full Name"] ?? "",
    dateOfBirth: toIsoDate(raw["Date Of Birth"] ?? ""),
    nationality: raw.Nationality ?? "",
    travelDocument: raw["Travel Document"] ?? "",
    travelDocNo: raw["Travel Doc. No"] ?? "",
    travelDocIssue: toIsoDate(raw["Travel Doc. Issue"] ?? ""),
    travelDocExpiry: toIsoDate(raw["Travel Doc. Expiry"] ?? ""),
  });
}

export function fieldsFromEvisaText(text: string): Partial<EVisaFieldsValue> {
  return fieldsFromRaw(extractFieldsFromLines(text));
}

export function fieldsFromEvisaPdfItems(
  items: PdfTextItem[]
): Partial<EVisaFieldsValue> {
  const raw = mergeFieldMaps(
    extractFieldsFromLayout(items),
    extractFieldsFromLines(itemsToText(items))
  );
  return fieldsFromRaw(raw);
}

export async function parseEvisaPdf(
  file: File
): Promise<Partial<EVisaFieldsValue>> {
  return fieldsFromEvisaPdfItems(await extractPdfItems(file));
}

export function evisaFilePath(orgId: string, visaId: string): string {
  return `${orgId}/${visaId}/evisa.pdf`;
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export async function uploadEvisaPdf(
  orgId: string,
  visaId: string,
  file: File
): Promise<EVisaFileMeta> {
  const path = evisaFilePath(orgId, visaId);
  const { error } = await supabase.storage.from(EVISA_BUCKET).upload(path, file, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) throw error;
  return {
    file_path: path,
    file_name: file.name,
    content_type: "application/pdf",
  };
}

export async function signedEvisaUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(EVISA_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function removeEvisaPdf(path: string | null | undefined) {
  if (!path) return;
  await supabase.storage.from(EVISA_BUCKET).remove([path]);
}

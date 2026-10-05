import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EVisaFields } from "../components/forms/EVisaFields";
import { PassportSelect } from "../components/forms/PassportSelect";
import { FormSection, SectionHeading } from "../components/forms/formStyles";
import { usePageHeader } from "../context/PageHeaderContext";
import { CUSTOMER_LIST_SELECT } from "../lib/customer";
import {
  embedOne,
  emptyEVisaFields,
  evisaFromRow,
  evisaPayload,
  evisaUpdatePayload,
  friendlyEvisaConflict,
  passportIdForTravelDoc,
  snapshotFromPassport,
  sameTravelDocNo,
  validateEVisaFields,
  type EVisaFieldErrors,
  type EVisaFieldsValue,
  type EVisaFileMeta,
} from "../lib/evisa";
import {
  EVISA_PDF_MAX_BYTES,
  extractPdfItems,
  fieldsFromEvisaPdfItems,
  isPdfFile,
  removeEvisaPdf,
  uploadEvisaPdf,
} from "../lib/evisaPdf";
import { supabase } from "../lib/supabase";
import type { CustomerWithCompany, EVisa, Visa } from "../types";

type ParseStatus = "idle" | "reading" | "filling";
type SaveStatus = "idle" | "uploading" | "saving";

function yieldPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function EVisaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parseGen = useRef(0);

  const [visa, setVisa] = useState<Visa | null>(null);
  const [customer, setCustomer] = useState<CustomerWithCompany | null>(null);
  const [existing, setExisting] = useState<EVisa | null>(null);
  const [passportId, setPassportId] = useState("");
  const [fields, setFields] = useState<EVisaFieldsValue>(emptyEVisaFields);
  const [errors, setErrors] = useState<EVisaFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeStoredFile, setRemoveStoredFile] = useState(false);
  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [parseFlash, setParseFlash] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setFormError(null);

      const { data: visaRow, error: visaErr } = await supabase
        .from("visas")
        .select("*, e_visas!visa_id (*)")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (visaErr || !visaRow) {
        setFormError(visaErr?.message ?? "Visa not found.");
        setLoading(false);
        return;
      }

      const row = visaRow as Visa & { e_visas: EVisa | EVisa[] | null };
      const evisa = embedOne(row.e_visas);
      setVisa(row);
      setExisting(evisa);

      const { data: custRow, error: custErr } = await supabase
        .from("customers")
        .select(CUSTOMER_LIST_SELECT)
        .eq("id", row.customer_id)
        .single();
      if (cancelled) return;
      if (custErr || !custRow) {
        setFormError(custErr?.message ?? "Customer not found.");
        setLoading(false);
        return;
      }

      const customerRow = custRow as CustomerWithCompany;
      const passports = customerRow.passports ?? [];
      setCustomer({ ...customerRow, passports });

      if (evisa) {
        setPassportId(evisa.passport_id);
        setFields(evisaFromRow(evisa));
      } else {
        const defaultPassport =
          passports.find((p) => p.id === row.passport_id) ?? passports[0] ?? null;
        const nextId = defaultPassport?.id ?? "";
        setPassportId(nextId);
        setFields({
          ...emptyEVisaFields(),
          ...snapshotFromPassport(
            emptyEVisaFields(),
            defaultPassport,
            customerRow.full_name
          ),
        });
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    function preventFileNav(e: globalThis.DragEvent) {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    }
    function resetDrag() {
      setDragOver(false);
    }
    window.addEventListener("dragover", preventFileNav);
    window.addEventListener("drop", preventFileNav);
    window.addEventListener("dragend", resetDrag);
    return () => {
      window.removeEventListener("dragover", preventFileNav);
      window.removeEventListener("drop", preventFileNav);
      window.removeEventListener("dragend", resetDrag);
    };
  }, []);

  const locked = busy || parseStatus !== "idle";

  const attachedName = pendingFile
    ? pendingFile.name
    : !removeStoredFile && existing?.file_name
      ? existing.file_name
      : null;

  const selectedPassport =
    customer?.passports?.find((p) => p.id === passportId) ?? null;
  const travelDocMismatch = Boolean(
    selectedPassport &&
      fields.travelDocNo.trim() &&
      !sameTravelDocNo(fields.travelDocNo, selectedPassport.passport_number)
  );

  function patchFields(patch: Partial<EVisaFieldsValue>) {
    setFields((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof EVisaFieldsValue)[]) {
        delete next[key];
      }
      if ("travelDocNo" in patch) delete next.passportId;
      return next;
    });
  }

  function onPassportChange(nextId: string) {
    setPassportId(nextId);
    setFormError(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.passportId;
      delete next.travelDocNo;
      return next;
    });
    const passport =
      customer?.passports?.find((p) => p.id === nextId) ?? null;
    setFields((prev) => ({
      ...prev,
      ...snapshotFromPassport(prev, passport, customer?.full_name ?? ""),
    }));
  }

  async function onPdfPicked(file: File) {
    if (!isPdfFile(file)) {
      setFormError("Choose a PDF file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > EVISA_PDF_MAX_BYTES) {
      setFormError("PDF must be 10 MB or smaller.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPendingFile(file);
    setRemoveStoredFile(false);
    setFormError(null);
    setParseFlash(null);
    const gen = ++parseGen.current;
    setParseStatus("reading");

    try {
      const items = await extractPdfItems(file);
      if (gen !== parseGen.current) return;
      setParseStatus("filling");
      await yieldPaint();
      if (gen !== parseGen.current) return;
      const patch = fieldsFromEvisaPdfItems(items);
      if (Object.keys(patch).length === 0) {
        setFormError(
          "Couldn’t read this PDF. Fill the fields yourself or try a different file."
        );
        return;
      }

      const matchedId = passportIdForTravelDoc(
        customer?.passports ?? [],
        patch.travelDocNo ?? ""
      );
      if (matchedId) {
        setPassportId(matchedId);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.passportId;
          return next;
        });
      }
      patchFields(patch);
      setParseFlash(
        `Filled from ${file.name} — check the fields before saving.`
      );
    } catch {
      if (gen !== parseGen.current) return;
      setFormError(
        "Couldn’t read this PDF. Fill the fields yourself or try a different file."
      );
    } finally {
      if (gen === parseGen.current) setParseStatus("idle");
    }
  }

  function onPdfDragEnter(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (locked || !Array.from(e.dataTransfer.types).includes("Files")) return;
    setDragOver(true);
  }

  function onPdfDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = locked ? "none" : "copy";
  }

  function onPdfDragLeave(e: DragEvent<HTMLLabelElement>) {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    setDragOver(false);
  }

  function onPdfDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (locked) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void onPdfPicked(file);
  }

  function clearPendingFile() {
    setPendingFile(null);
    setParseFlash(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachedFile() {
    clearPendingFile();
    if (existing?.file_path) setRemoveStoredFile(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!visa || !id) return;
    setFormError(null);
    const nextErrors = validateEVisaFields(
      fields,
      passportId,
      selectedPassport?.passport_number
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (
        selectedPassport &&
        fields.travelDocNo.trim() &&
        !sameTravelDocNo(fields.travelDocNo, selectedPassport.passport_number)
      ) {
        setFormError(
          `Travel doc. no ${fields.travelDocNo.trim()} doesn’t match the linked passport ${selectedPassport.passport_number}.`
        );
      }
      return;
    }
    setBusy(true);

    try {
      let fileMeta: EVisaFileMeta | null | undefined;
      if (pendingFile) {
        setSaveStatus("uploading");
        fileMeta = await uploadEvisaPdf(visa.org_id, visa.id, pendingFile);
      } else if (removeStoredFile) {
        setSaveStatus("uploading");
        await removeEvisaPdf(existing?.file_path);
        fileMeta = {
          file_path: null,
          file_name: null,
          content_type: null,
        };
      }

      setSaveStatus("saving");
      const result = existing
        ? await supabase
            .from("e_visas")
            .update(evisaUpdatePayload(passportId, fields, fileMeta))
            .eq("id", existing.id)
        : await supabase
            .from("e_visas")
            .insert(
              evisaPayload(visa.org_id, visa.id, passportId, fields, fileMeta)
            );

      if (result.error) {
        setFormError(friendlyEvisaConflict(result.error.message));
        return;
      }
      navigate(`/visas/${id}`, {
        state: {
          flashSuccess: existing ? "e-Visa updated." : "e-Visa saved.",
        },
      });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Couldn’t upload the PDF."
      );
    } finally {
      setBusy(false);
      setSaveStatus("idle");
    }
  }

  usePageHeader({
    title: existing ? "Edit e-visa" : "Add e-visa",
    backTo: `/visas/${id}`,
  });

  if (!id) return null;

  if (loading) {
    return <p className="text-muted">Loading…</p>;
  }

  if (!visa) {
    return (
      <div className="space-y-2">
        <p className="text-red-700">{formError ?? "Visa not found."}</p>
        <Link to="/visas/active" className="link-brand text-sm">
          ← Back to list
        </Link>
      </div>
    );
  }

  const saveLabel =
    saveStatus === "uploading"
      ? "Uploading PDF…"
      : saveStatus === "saving" || busy
        ? "Saving…"
        : "Save";

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="panel space-y-5 p-5 sm:p-6"
        aria-busy={locked}
      >
        <FormSection>
          <SectionHeading
            step={1}
            title="e-visa PDF"
            hint="Optional. The file is stored as the original document, and labeled text fills the fields below."
          />
          <div className="space-y-3">
            <label
              data-evisa-drop
              onDragEnter={onPdfDragEnter}
              onDragOver={onPdfDragOver}
              onDragLeave={onPdfDragLeave}
              onDrop={onPdfDrop}
              className={`flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition ${
                locked
                  ? "cursor-not-allowed border-line bg-paper opacity-60"
                  : dragOver
                    ? "border-brand bg-brand-soft"
                    : "cursor-pointer border-line bg-paper hover:border-brand/40 hover:bg-brand-soft/40 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                disabled={locked}
                aria-label="e-visa PDF"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onPdfPicked(file);
                }}
              />
              <span className="text-sm font-medium text-ink">
                {dragOver ? (
                  "Release to attach this PDF"
                ) : attachedName ? (
                  <>
                    Drop a PDF to replace it, or{" "}
                    <span className="link-brand">browse</span>
                  </>
                ) : (
                  <>
                    Drop a PDF here, or <span className="link-brand">browse</span>
                  </>
                )}
              </span>
              <span className="mt-1 text-xs text-muted">
                One PDF, 10 MB or smaller
              </span>
            </label>
            {attachedName ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-ink">{attachedName}</span>
                <button
                  type="button"
                  disabled={locked}
                  className="btn-ghost px-3 py-1.5"
                  onClick={removeAttachedFile}
                >
                  Remove
                </button>
              </div>
            ) : null}
            {parseStatus === "reading" ? (
              <p className="callout-warn" role="status">
                Reading PDF…
              </p>
            ) : null}
            {parseStatus === "filling" ? (
              <p className="callout-warn" role="status">
                Filling e-visa fields…
              </p>
            ) : null}
            {saveStatus === "uploading" ? (
              <p className="callout-warn" role="status">
                Uploading PDF…
              </p>
            ) : null}
            {parseFlash ? (
              <p className="flash-success" role="status">
                {parseFlash}
              </p>
            ) : null}
          </div>
        </FormSection>

        <FormSection>
          <SectionHeading
            step={2}
            title="Passport"
            hint="Linked to this customer’s travel document. Number and expiry fill in from the booklet you pick."
          />
          <PassportSelect
            passports={customer?.passports ?? []}
            passportId={passportId}
            onChange={onPassportChange}
            error={errors.passportId}
            disabled={locked}
          />
          {travelDocMismatch && selectedPassport ? (
            <p className="callout-warn" role="alert">
              Travel doc. no {fields.travelDocNo.trim()} doesn’t match the
              linked passport {selectedPassport.passport_number}. Select the
              matching booklet or correct the number before saving.
            </p>
          ) : null}
        </FormSection>

        <FormSection>
          <SectionHeading step={3} title="Document details" />
          <EVisaFields
            value={fields}
            onChange={patchFields}
            errors={errors}
            disabled={locked}
          />
        </FormSection>

        {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Link to={`/visas/${id}`} className="btn-ghost">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={locked || !customer}
            className="btn-primary"
          >
            {saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

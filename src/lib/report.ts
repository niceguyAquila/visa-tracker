import * as XLSX from "xlsx";
import { currentPassport, CUSTOMER_LIST_SELECT } from "./customer";
import { todayISODate } from "./dates";
import { EVISA_EMBED, embedOne } from "./evisa";
import { supabase } from "./supabase";
import { deriveLeavePhase, isVisaLanded, leavePhaseLabel } from "./visa";
import { finishDueVisas } from "./visaSweep";
import type { CustomerWithCompany, EVisa, VisaWithCustomer } from "../types";

const PAGE_SIZE = 1000;

const VISA_REPORT_SELECT =
  `*, customers ( id, full_name, company_id, contact_number, companies ( id, name ) ), passports!passport_id ( id, passport_number, passport_expiry ), ${EVISA_EMBED}`;

type ReportOptions = {
  companyId?: string | null;
  companyName?: string | null;
};

async function fetchAll<T>(
  table: string,
  select: string,
  order?: { column: string; ascending: boolean }
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let q = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (order) q = q.order(order.column, { ascending: order.ascending });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

function cell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function sheetFromRows(headers: string[], rows: string[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const len = (row[i] ?? "").length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 1, 12), 42) };
  });
  return ws;
}

function fileName(companyName?: string | null): string {
  const scope = companyName
    ? companyName.replace(/[^\w-]+/g, "-").replace(/-+/g, "-")
    : "all-companies";
  return `visa-report-${scope}-${todayISODate()}.xlsx`;
}

export async function downloadCustomerVisaReport(
  options: ReportOptions = {}
): Promise<void> {
  const companyId = options.companyId || null;

  await finishDueVisas();

  const [customers, visas] = await Promise.all([
    fetchAll<CustomerWithCompany>("customers", CUSTOMER_LIST_SELECT, {
      column: "full_name",
      ascending: true,
    }),
    fetchAll<VisaWithCustomer>("visas", VISA_REPORT_SELECT, {
      column: "created_at",
      ascending: false,
    }),
  ]);

  const scopedCustomers = customers
    .map((c) => ({ ...c, passports: c.passports ?? [] }))
    .filter((c) => !companyId || c.company_id === companyId);

  const customerIds = new Set(scopedCustomers.map((c) => c.id));
  const customerById = new Map(scopedCustomers.map((c) => [c.id, c]));

  const scopedVisas = visas.filter((v) => customerIds.has(v.customer_id));

  const evisaCountByCustomer = new Map<string, number>();
  for (const v of scopedVisas) {
    if (embedOne(v.e_visas)) {
      evisaCountByCustomer.set(
        v.customer_id,
        (evisaCountByCustomer.get(v.customer_id) ?? 0) + 1
      );
    }
  }

  const customerHeaders = [
    "Company",
    "Full name",
    "Phone",
    "Current passport",
    "Passport expiry",
    "Visa count",
    "Extension count",
    "E-visas",
    "In-Progress visa",
  ];

  const customerRows = scopedCustomers.map((c) => {
    const current = currentPassport(c.passports);
    const hasInProgress = scopedVisas.some(
      (v) => v.customer_id === c.id && v.status === "In-Progress"
    );
    return [
      cell(c.companies?.name),
      cell(c.full_name),
      cell(c.contact_number),
      cell(current?.passport_number),
      cell(current?.passport_expiry),
      cell(c.visa_count),
      cell(c.extension_count),
      cell(evisaCountByCustomer.get(c.id) ?? 0),
      cell(hasInProgress),
    ];
  });

  const visaHeaders = [
    "Company",
    "Full name",
    "Phone",
    "Passport no",
    "Passport expiry",
    "Status",
    "Landed",
    "Visa days",
    "Route",
    "Date entered",
    "Ext. due",
    "Date extended",
    "Extension done",
    "Leave by",
    "Leave date",
    "Leave status",
    "Cycle done",
    "eVISA number",
    "Ref. number",
    "eVISA issue",
    "eVISA expire",
    "Place of issue",
    "Remarks",
    "Gender",
    "Name on e-visa",
    "Date of birth",
    "Nationality",
    "Travel document",
    "Travel doc. no",
    "Travel doc. issue",
    "Travel doc. expiry",
  ];

  const visaRows = [...scopedVisas]
    .sort((a, b) => {
      const aName = a.customers?.full_name ?? customerById.get(a.customer_id)?.full_name ?? "";
      const bName = b.customers?.full_name ?? customerById.get(b.customer_id)?.full_name ?? "";
      const byName = aName.localeCompare(bName);
      if (byName) return byName;
      return (b.date_entered ?? "").localeCompare(a.date_entered ?? "");
    })
    .map((v) => {
      const customer = v.customers;
      const companyName =
        customer?.companies?.name ??
        customerById.get(v.customer_id)?.companies?.name ??
        "";
      const fullName =
        customer?.full_name ?? customerById.get(v.customer_id)?.full_name ?? "";
      const phone = customerById.get(v.customer_id)?.contact_number ?? "";
      const evisa: EVisa | null = embedOne(v.e_visas);
      return [
        cell(companyName),
        cell(fullName),
        cell(phone),
        cell(v.passports?.passport_number),
        cell(v.passports?.passport_expiry),
        cell(v.status),
        cell(isVisaLanded(v.date_entered)),
        cell(v.visa_days),
        cell(v.route),
        cell(v.date_entered),
        cell(v.date_to_extension),
        cell(v.date_extended),
        cell(v.extension_done),
        cell(v.leave_date_reminder),
        cell(v.actual_leave_date),
        cell(leavePhaseLabel(deriveLeavePhase(v.actual_leave_date))),
        cell(v.cycle_done),
        cell(evisa?.evisa_number),
        cell(evisa?.ref_number),
        cell(evisa?.issue_date),
        cell(evisa?.expire_date),
        cell(evisa?.place_of_issue),
        cell(evisa?.remarks),
        cell(evisa?.gender),
        cell(evisa?.full_name),
        cell(evisa?.date_of_birth),
        cell(evisa?.nationality),
        cell(evisa?.travel_document),
        cell(evisa?.travel_doc_no),
        cell(evisa?.travel_doc_issue),
        cell(evisa?.travel_doc_expiry),
      ];
    });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(visaHeaders, visaRows),
    "Visas"
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(customerHeaders, customerRows),
    "Customers"
  );
  XLSX.writeFile(wb, fileName(options.companyName));
}

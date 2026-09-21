import { currentPassport, isWorkingCustomer } from "./customer";
import { daysUntilISODate, isBeforeMonths } from "./dates";
import type {
  Company,
  CustomerStatus,
  CustomerWithCompany,
  Passport,
  VisaStatus,
} from "../types";

export type Kpis = {
  customers: number;
  companies: number;
  expired: number;
  visas: number;
  extensions: number;
  activeVisas: number;
  notLanded: number;
  archivedVisas: number;
  extDue10: number;
};

export type CompanyMetrics = Kpis & {
  companyId: string;
  name: string;
  color: string | null;
};

export type VisaForMetrics = {
  status: VisaStatus;
  date_entered: string | null;
  date_to_extension: string | null;
  extension_done: boolean;
  company_id: string | null;
};

const emptyKpis = (companyCount: number, customerCount = 0): Kpis => ({
  customers: customerCount,
  companies: companyCount,
  expired: 0,
  visas: 0,
  extensions: 0,
  activeVisas: 0,
  notLanded: 0,
  archivedVisas: 0,
  extDue10: 0,
});

export type CustomerForMetrics = Pick<
  CustomerWithCompany,
  "company_id" | "visa_count" | "extension_count"
> & {
  status?: CustomerStatus | null;
  passports?: Passport[];
};

export function customersForCompany<T extends { company_id: string }>(
  customers: T[],
  companyId: string | null
): T[] {
  if (!companyId) return customers;
  return customers.filter((c) => c.company_id === companyId);
}

export function visasForCompany(
  visas: VisaForMetrics[],
  companyId: string | null
): VisaForMetrics[] {
  if (!companyId) return visas;
  return visas.filter((v) => v.company_id === companyId);
}

function addPassportKpis(kpis: Kpis, customers: CustomerForMetrics[]) {
  for (const c of customers) {
    const current = currentPassport(c.passports);
    if (current && isBeforeMonths(current.passport_expiry, 7)) {
      kpis.expired += 1;
    }
    kpis.visas += c.visa_count;
    kpis.extensions += c.extension_count;
  }
}

function addVisaKpis(kpis: Kpis, visas: VisaForMetrics[]) {
  for (const v of visas) {
    if (v.status === "In-Progress") {
      if (!v.date_entered) {
        kpis.notLanded += 1;
        continue;
      }
      kpis.activeVisas += 1;
      if (v.extension_done || !v.date_to_extension) continue;
      const d = daysUntilISODate(v.date_to_extension);
      if (d >= 0 && d <= 10) kpis.extDue10 += 1;
    } else {
      kpis.archivedVisas += 1;
    }
  }
}

export function aggregateKpis(
  customers: CustomerForMetrics[],
  companyCount: number,
  visas: VisaForMetrics[] = []
): Kpis {
  const kpis = emptyKpis(
    companyCount,
    customers.filter(isWorkingCustomer).length
  );
  addPassportKpis(kpis, customers);
  addVisaKpis(kpis, visas);
  return kpis;
}

export function metricsByCompany(
  companies: Company[],
  customers: CustomerForMetrics[],
  visas: VisaForMetrics[] = []
): CompanyMetrics[] {
  return companies
    .map((co) => {
      const scopedCustomers = customersForCompany(customers, co.id);
      const scopedVisas = visasForCompany(visas, co.id);
      return {
        companyId: co.id,
        name: co.name,
        color: co.color,
        ...aggregateKpis(scopedCustomers, 1, scopedVisas),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

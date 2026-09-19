import { currentPassport } from "./customer";
import { daysUntilISODate } from "./dates";
import type { Company, CustomerWithCompany, Passport, VisaStatus } from "../types";

export type Kpis = {
  customers: number;
  companies: number;
  expired: number;
  expiring10: number;
  expiring30: number;
  visas: number;
  extensions: number;
  activeVisas: number;
  archivedVisas: number;
  extToday: number;
  extDue10: number;
  extDue30: number;
};

export type CompanyMetrics = Kpis & {
  companyId: string;
  name: string;
  color: string | null;
};

export type VisaForMetrics = {
  status: VisaStatus;
  date_to_extension: string;
  extension_done: boolean;
  company_id: string | null;
};

const emptyKpis = (companyCount: number, customerCount = 0): Kpis => ({
  customers: customerCount,
  companies: companyCount,
  expired: 0,
  expiring10: 0,
  expiring30: 0,
  visas: 0,
  extensions: 0,
  activeVisas: 0,
  archivedVisas: 0,
  extToday: 0,
  extDue10: 0,
  extDue30: 0,
});

export type CustomerForMetrics = Pick<
  CustomerWithCompany,
  "company_id" | "visa_count" | "extension_count"
> & {
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
    if (current) {
      const d = daysUntilISODate(current.passport_expiry);
      if (d < 0) kpis.expired += 1;
      else if (d <= 10) kpis.expiring10 += 1;
      else if (d <= 30) kpis.expiring30 += 1;
    }
    kpis.visas += c.visa_count;
    kpis.extensions += c.extension_count;
  }
}

function addVisaKpis(kpis: Kpis, visas: VisaForMetrics[]) {
  for (const v of visas) {
    if (v.status === "In-Progress") {
      kpis.activeVisas += 1;
      if (v.extension_done) continue;
      const d = daysUntilISODate(v.date_to_extension);
      if (d === 0) kpis.extToday += 1;
      else if (d > 0 && d <= 10) kpis.extDue10 += 1;
      else if (d > 10 && d <= 30) kpis.extDue30 += 1;
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
  const kpis = emptyKpis(companyCount, customers.length);
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

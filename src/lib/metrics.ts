import { daysUntilISODate } from "./dates";
import type { Company, Customer } from "../types";

export type Kpis = {
  customers: number;
  companies: number;
  expired: number;
  expiring10: number;
  expiring30: number;
  visas: number;
  extensions: number;
};

export type CompanyMetrics = Kpis & {
  companyId: string;
  name: string;
  color: string | null;
};

export function customersForCompany(
  customers: Customer[],
  companyId: string | null
): Customer[] {
  if (!companyId) return customers;
  return customers.filter((c) => c.company_id === companyId);
}

export function aggregateKpis(
  customers: Customer[],
  companyCount: number
): Kpis {
  const kpis: Kpis = {
    customers: customers.length,
    companies: companyCount,
    expired: 0,
    expiring10: 0,
    expiring30: 0,
    visas: 0,
    extensions: 0,
  };

  for (const c of customers) {
    const d = daysUntilISODate(c.passport_expiry);
    if (d < 0) kpis.expired += 1;
    else if (d <= 10) kpis.expiring10 += 1;
    else if (d <= 30) kpis.expiring30 += 1;
    kpis.visas += c.visa_count;
    kpis.extensions += c.extension_count;
  }

  return kpis;
}

export function metricsByCompany(
  companies: Company[],
  customers: Customer[]
): CompanyMetrics[] {
  return companies
    .map((co) => {
      const scoped = customersForCompany(customers, co.id);
      return {
        companyId: co.id,
        name: co.name,
        color: co.color,
        ...aggregateKpis(scoped, 1),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

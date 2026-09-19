import type { CustomerWithCompany, DuplicateExclusion, Passport } from "../types";

export const CUSTOMER_LIST_SELECT =
  "*, companies ( id, name, color ), passports ( id, org_id, customer_id, passport_number, passport_expiry, is_current, created_at )";

export function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function currentPassport(
  passports: Passport[] | null | undefined
): Passport | null {
  if (!passports?.length) return null;
  return passports.find((p) => p.is_current) ?? passports[0] ?? null;
}

export function sortPassports(passports: Passport[]): Passport[] {
  return [...passports].sort((a, b) => {
    if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
    return a.passport_expiry < b.passport_expiry ? 1 : -1;
  });
}

export function namesMatch(a: string, b: string): boolean {
  return normalizePersonName(a) === normalizePersonName(b);
}

export function duplicateCustomerGroups(
  customers: CustomerWithCompany[]
): CustomerWithCompany[][] {
  const map = new Map<string, CustomerWithCompany[]>();
  for (const c of customers) {
    const key = `${c.company_id}::${normalizePersonName(c.full_name)}`;
    const group = map.get(key);
    if (group) group.push(c);
    else map.set(key, [c]);
  }
  return [...map.values()]
    .filter((group) => group.length > 1)
    .sort((a, b) => a[0].full_name.localeCompare(b[0].full_name));
}

export function groupIdFingerprint(ids: string[]): string {
  return [...ids].sort().join(",");
}

export function isReviewedDistinct(
  group: CustomerWithCompany[],
  exclusions: DuplicateExclusion[]
): boolean {
  if (group.length < 2) return false;
  const nameKey = normalizePersonName(group[0].full_name);
  const companyId = group[0].company_id;
  const fingerprint = groupIdFingerprint(group.map((c) => c.id));
  return exclusions.some(
    (e) =>
      e.company_id === companyId &&
      e.name_key === nameKey &&
      groupIdFingerprint(e.customer_ids) === fingerprint
  );
}

export function unresolvedDuplicateGroups(
  customers: CustomerWithCompany[],
  exclusions: DuplicateExclusion[]
): CustomerWithCompany[][] {
  return duplicateCustomerGroups(customers).filter(
    (group) => !isReviewedDistinct(group, exclusions)
  );
}

export function friendlyPassportConflict(message: string): string {
  if (/passports_org_id_lower_number|unique|duplicate/i.test(message)) {
    return "That passport number is already recorded.";
  }
  return message;
}

export function friendlyMergeConflict(message: string): string {
  if (/IN_PROGRESS_CONFLICT/i.test(message)) {
    return "These customers both have an In-Progress visa. Finish or archive one before merging.";
  }
  if (/passports_org_id_lower_number/i.test(message)) {
    return "These records share a passport number, so they cannot be merged.";
  }
  return message;
}

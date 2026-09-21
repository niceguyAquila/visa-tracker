export type Organization = {
  id: string;
  name: string;
  invite_code: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
};

export type Company = {
  id: string;
  org_id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export type Passport = {
  id: string;
  org_id: string;
  customer_id: string;
  passport_number: string;
  passport_expiry: string;
  is_current: boolean;
  created_at: string;
};

export type CustomerStatus = "Working" | "Currently Not Working";

export type Customer = {
  id: string;
  org_id: string;
  company_id: string;
  full_name: string;
  visa_count: number;
  extension_count: number;
  contact_number: string;
  status: CustomerStatus;
  created_at: string;
};

export type CustomerWithCompany = Customer & {
  companies: Pick<Company, "id" | "name" | "color"> | null;
  passports: Passport[];
};

export type DuplicateExclusion = {
  id: string;
  org_id: string;
  company_id: string;
  name_key: string;
  customer_ids: string[];
  created_at: string;
};

export type VisaDays = "90 Days" | "30 Days";

export type VisaStatus = "In-Progress" | "Cuti" | "Blacklist" | "Finished";

export type Visa = {
  id: string;
  org_id: string;
  customer_id: string;
  passport_id: string;
  visa_days: VisaDays;
  date_entered: string | null;
  date_to_extension: string | null;
  date_extended: string | null;
  extension_done: boolean;
  leave_date_reminder: string | null;
  actual_leave_date: string | null;
  cycle_done: boolean;
  cuti: boolean;
  blacklist: boolean;
  status: VisaStatus;
  route: string;
  exit_route: string;
  created_at: string;
};

export type EntryPort = {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
};

export type EVisa = {
  id: string;
  org_id: string;
  visa_id: string;
  passport_id: string;
  evisa_number: string;
  ref_number: string;
  issue_date: string;
  expire_date: string;
  place_of_issue: string;
  remarks: string;
  gender: string;
  full_name: string;
  date_of_birth: string | null;
  nationality: string;
  travel_document: string;
  travel_doc_no: string;
  travel_doc_issue: string | null;
  travel_doc_expiry: string | null;
  file_path: string | null;
  file_name: string | null;
  content_type: string | null;
  created_at: string;
};

export type VisaWithCustomer = Visa & {
  customers: (Pick<Customer, "id" | "full_name" | "company_id"> & {
    companies: Pick<Company, "id" | "name" | "color"> | null;
  }) | null;
  passports: Pick<Passport, "id" | "passport_number" | "passport_expiry"> | null;
  e_visas?: EVisa | EVisa[] | null;
};

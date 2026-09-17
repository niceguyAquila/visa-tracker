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

export type Customer = {
  id: string;
  org_id: string;
  company_id: string;
  full_name: string;
  passport_number: string;
  passport_expiry: string;
  visa_count: number;
  extension_count: number;
  contact_number: string;
  created_at: string;
};

export type CustomerWithCompany = Customer & {
  companies: Pick<Company, "id" | "name" | "color"> | null;
};

export type VisaDays = "90 Days" | "30 Days";

export type VisaStatus = "In-Progress" | "Cuti" | "Blacklist" | "Finished";

export type Visa = {
  id: string;
  org_id: string;
  customer_id: string;
  visa_days: VisaDays;
  date_entered: string;
  date_to_extension: string;
  date_extended: string | null;
  extension_done: boolean;
  leave_date_reminder: string | null;
  cycle_done: boolean;
  cuti: boolean;
  blacklist: boolean;
  status: VisaStatus;
  masuk_dari: string;
  created_at: string;
};

export type EntryPort = {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
};

export type VisaWithCustomer = Visa & {
  customers: (Pick<
    Customer,
    "id" | "full_name" | "passport_number" | "company_id"
  > & {
    companies: Pick<Company, "id" | "name" | "color"> | null;
  }) | null;
};

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

export type Worker = {
  id: string;
  org_id: string;
  full_name: string;
  employer_ref: string | null;
  notes: string | null;
  created_at: string;
};

export type VisaRecord = {
  id: string;
  worker_id: string;
  visa_label: string;
  issue_date: string | null;
  expiry_date: string;
  extension_deadline: string | null;
  notes: string | null;
  reminder_10d_sent: boolean;
  created_at: string;
};

export type WorkerWithVisas = Worker & { visa_records: VisaRecord[] };

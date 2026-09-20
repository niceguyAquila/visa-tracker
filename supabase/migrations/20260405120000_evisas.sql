-- Optional 1:1 e-visa document snapshot on a visa stay, linked to a passport.

create table public.e_visas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  visa_id uuid not null unique references public.visas (id) on delete cascade,
  passport_id uuid not null references public.passports (id) on delete restrict,
  evisa_number text not null,
  ref_number text not null default '',
  issue_date date not null,
  expire_date date not null,
  place_of_issue text not null default '',
  remarks text not null default '',
  gender text not null default '',
  full_name text not null,
  date_of_birth date,
  nationality text not null default '',
  travel_document text not null default 'Passport',
  travel_doc_no text not null,
  travel_doc_issue date,
  travel_doc_expiry date,
  created_at timestamptz not null default now(),
  constraint e_visas_number_not_blank check (length(trim(evisa_number)) > 0),
  constraint e_visas_full_name_not_blank check (length(trim(full_name)) > 0),
  constraint e_visas_travel_document_not_blank check (length(trim(travel_document)) > 0),
  constraint e_visas_travel_doc_no_not_blank check (length(trim(travel_doc_no)) > 0),
  constraint e_visas_gender_valid check (gender in ('', 'Male', 'Female')),
  constraint e_visas_expire_on_or_after_issue check (expire_date >= issue_date)
);

create index e_visas_org_id_idx on public.e_visas (org_id);
create index e_visas_passport_id_idx on public.e_visas (passport_id);

create unique index e_visas_org_id_lower_number_uidx
  on public.e_visas (org_id, lower(trim(evisa_number)));

create or replace function public.enforce_evisa_visa_passport()
returns trigger
language plpgsql
as $$
declare
  visa_org uuid;
  visa_customer uuid;
  passport_customer uuid;
begin
  select v.org_id, v.customer_id into visa_org, visa_customer
  from public.visas v
  where v.id = new.visa_id;

  if visa_org is null then
    raise exception 'Visa not found';
  end if;

  if visa_org is distinct from new.org_id then
    raise exception 'e-visa org_id must match visa org_id';
  end if;

  select p.customer_id into passport_customer
  from public.passports p
  where p.id = new.passport_id;

  if passport_customer is null then
    raise exception 'Passport not found';
  end if;

  if passport_customer is distinct from visa_customer then
    raise exception 'Passport must belong to the visa customer';
  end if;

  return new;
end;
$$;

drop trigger if exists e_visas_visa_passport_check on public.e_visas;
create trigger e_visas_visa_passport_check
  before insert or update of org_id, visa_id, passport_id on public.e_visas
  for each row execute function public.enforce_evisa_visa_passport();

alter table public.e_visas enable row level security;

create policy "e_visas_select_authenticated"
  on public.e_visas for select
  to authenticated
  using (true);

create policy "e_visas_insert_authenticated"
  on public.e_visas for insert
  to authenticated
  with check (true);

create policy "e_visas_update_authenticated"
  on public.e_visas for update
  to authenticated
  using (true);

create policy "e_visas_delete_authenticated"
  on public.e_visas for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.e_visas to authenticated;

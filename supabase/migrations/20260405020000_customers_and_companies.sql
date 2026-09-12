-- Rework: workers + visa_records → companies + customers

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint companies_name_not_blank check (length(trim(name)) > 0)
);

create index companies_org_id_idx on public.companies (org_id);
create unique index companies_org_id_lower_name_uidx
  on public.companies (org_id, lower(name));

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  full_name text not null,
  passport_number text not null,
  passport_expiry date not null,
  visa_count integer not null default 0 check (visa_count >= 0),
  extension_count integer not null default 0 check (extension_count >= 0),
  contact_number text not null,
  created_at timestamptz not null default now(),
  constraint customers_full_name_not_blank check (length(trim(full_name)) > 0)
);

create index customers_org_id_idx on public.customers (org_id);
create index customers_company_id_idx on public.customers (company_id);
create index customers_passport_expiry_idx on public.customers (passport_expiry);

create or replace function public.enforce_customer_company_org()
returns trigger
language plpgsql
as $$
declare
  company_org uuid;
begin
  select c.org_id into company_org
  from public.companies c
  where c.id = new.company_id;

  if company_org is null then
    raise exception 'Company not found';
  end if;

  if company_org is distinct from new.org_id then
    raise exception 'Customer org_id must match company org_id';
  end if;

  return new;
end;
$$;

drop trigger if exists customers_company_org_check on public.customers;
create trigger customers_company_org_check
  before insert or update of org_id, company_id on public.customers
  for each row execute function public.enforce_customer_company_org();

-- ---------------------------------------------------------------------------
-- Migrate existing workers (visa history is dropped)
-- ---------------------------------------------------------------------------
do $$
declare
  w record;
  company_name text;
  company_uuid uuid;
begin
  for w in select * from public.workers loop
    company_name := coalesce(nullif(trim(w.employer_ref), ''), 'Unassigned');

    select c.id into company_uuid
    from public.companies c
    where c.org_id = w.org_id
      and lower(c.name) = lower(company_name);

    if company_uuid is null then
      insert into public.companies (org_id, name)
      values (w.org_id, company_name)
      returning id into company_uuid;
    end if;

    insert into public.customers (
      id,
      org_id,
      company_id,
      full_name,
      passport_number,
      passport_expiry,
      visa_count,
      extension_count,
      contact_number,
      created_at
    )
    values (
      w.id,
      w.org_id,
      company_uuid,
      w.full_name,
      'UNKNOWN',
      '2099-12-31'::date,
      0,
      0,
      '',
      w.created_at
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Drop visa_records + workers + reminder helpers
-- ---------------------------------------------------------------------------
drop trigger if exists visa_expiry_changed on public.visa_records;
drop function if exists public.reset_visa_reminder_on_expiry_change();

drop policy if exists "visas_select" on public.visa_records;
drop policy if exists "visas_insert" on public.visa_records;
drop policy if exists "visas_update" on public.visa_records;
drop policy if exists "visas_delete" on public.visa_records;

drop table if exists public.visa_records;

drop policy if exists "workers_select" on public.workers;
drop policy if exists "workers_insert" on public.workers;
drop policy if exists "workers_update" on public.workers;
drop policy if exists "workers_delete" on public.workers;

drop table if exists public.workers;

drop function if exists public.is_worker_org_member(uuid);

-- ---------------------------------------------------------------------------
-- RLS helpers + policies
-- ---------------------------------------------------------------------------
create or replace function public.is_customer_org_member(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers c
    join public.organization_members om on om.org_id = c.org_id
    where c.id = p_customer_id
      and om.user_id = auth.uid()
  );
$$;

revoke all on function public.is_customer_org_member(uuid) from public;
grant execute on function public.is_customer_org_member(uuid) to authenticated, anon;

alter table public.companies enable row level security;
alter table public.customers enable row level security;

create policy "companies_select"
  on public.companies for select
  using (public.is_org_member(org_id));

create policy "companies_insert"
  on public.companies for insert
  with check (public.is_org_member(org_id));

create policy "companies_update"
  on public.companies for update
  using (public.is_org_member(org_id));

create policy "companies_delete"
  on public.companies for delete
  using (public.is_org_member(org_id));

create policy "customers_select"
  on public.customers for select
  using (public.is_org_member(org_id));

create policy "customers_insert"
  on public.customers for insert
  with check (public.is_org_member(org_id));

create policy "customers_update"
  on public.customers for update
  using (public.is_org_member(org_id));

create policy "customers_delete"
  on public.customers for delete
  using (public.is_org_member(org_id));

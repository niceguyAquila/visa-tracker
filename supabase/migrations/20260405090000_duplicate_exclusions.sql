-- Allow same-name people at one company to be marked as distinct (not merge candidates).

create table public.duplicate_exclusions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name_key text not null,
  customer_ids uuid[] not null,
  created_at timestamptz not null default now(),
  constraint duplicate_exclusions_name_key_not_blank check (length(trim(name_key)) > 0),
  constraint duplicate_exclusions_ids_not_empty check (cardinality(customer_ids) >= 2),
  constraint duplicate_exclusions_org_company_name_key unique (org_id, company_id, name_key)
);

create index duplicate_exclusions_org_id_idx on public.duplicate_exclusions (org_id);
create index duplicate_exclusions_company_id_idx on public.duplicate_exclusions (company_id);

alter table public.duplicate_exclusions enable row level security;

create policy "duplicate_exclusions_select_authenticated"
  on public.duplicate_exclusions for select
  to authenticated
  using (true);

create policy "duplicate_exclusions_insert_authenticated"
  on public.duplicate_exclusions for insert
  to authenticated
  with check (true);

create policy "duplicate_exclusions_update_authenticated"
  on public.duplicate_exclusions for update
  to authenticated
  using (true);

create policy "duplicate_exclusions_delete_authenticated"
  on public.duplicate_exclusions for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.duplicate_exclusions to authenticated;

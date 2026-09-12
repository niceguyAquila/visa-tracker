-- Visas linked to customers: one In-Progress session per customer

create table public.visas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  visa_days text not null check (visa_days in ('90 Days', '30 Days')),
  date_entered date not null,
  date_to_extension date generated always as (
    case visa_days
      when '90 Days' then date_entered + 80
      when '30 Days' then date_entered + 20
    end
  ) stored,
  date_extended date,
  extension_done boolean not null default false,
  leave_date_reminder date generated always as (
    case when date_extended is not null then date_extended + 50 end
  ) stored,
  cycle_done boolean not null default false,
  cuti boolean not null default false,
  blacklist boolean not null default false,
  status text generated always as (
    case
      when cycle_done then 'Finished'
      when blacklist then 'Blacklist'
      when cuti then 'Cuti'
      else 'In-Progress'
    end
  ) stored,
  masuk_dari text not null default '',
  created_at timestamptz not null default now()
);

create index visas_org_id_idx on public.visas (org_id);
create index visas_customer_id_idx on public.visas (customer_id);
create index visas_status_idx on public.visas (status);
create index visas_date_to_extension_idx on public.visas (date_to_extension);
create index visas_leave_date_reminder_idx on public.visas (leave_date_reminder);

create unique index visas_one_in_progress_per_customer_uidx
  on public.visas (customer_id)
  where status = 'In-Progress';

create or replace function public.enforce_visa_customer_org()
returns trigger
language plpgsql
as $$
declare
  customer_org uuid;
begin
  select c.org_id into customer_org
  from public.customers c
  where c.id = new.customer_id;

  if customer_org is null then
    raise exception 'Customer not found';
  end if;

  if customer_org is distinct from new.org_id then
    raise exception 'Visa org_id must match customer org_id';
  end if;

  return new;
end;
$$;

drop trigger if exists visas_customer_org_check on public.visas;
create trigger visas_customer_org_check
  before insert or update of org_id, customer_id on public.visas
  for each row execute function public.enforce_visa_customer_org();

alter table public.visas enable row level security;

create policy "visas_select_authenticated"
  on public.visas for select
  to authenticated
  using (true);

create policy "visas_insert_authenticated"
  on public.visas for insert
  to authenticated
  with check (true);

create policy "visas_update_authenticated"
  on public.visas for update
  to authenticated
  using (true);

create policy "visas_delete_authenticated"
  on public.visas for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.visas to authenticated;

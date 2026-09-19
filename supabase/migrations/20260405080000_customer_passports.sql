-- Passports as child records of customers; visas remember which booklet was used.

-- ---------------------------------------------------------------------------
-- Passports
-- ---------------------------------------------------------------------------
create table public.passports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  passport_number text not null,
  passport_expiry date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint passports_number_not_blank check (length(trim(passport_number)) > 0)
);

create index passports_org_id_idx on public.passports (org_id);
create index passports_customer_id_idx on public.passports (customer_id);
create index passports_passport_expiry_idx on public.passports (passport_expiry);

create unique index passports_org_id_lower_number_uidx
  on public.passports (org_id, lower(trim(passport_number)));

create unique index passports_one_current_per_customer_uidx
  on public.passports (customer_id)
  where is_current;

create or replace function public.enforce_passport_customer_org()
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
    raise exception 'Passport org_id must match customer org_id';
  end if;

  return new;
end;
$$;

drop trigger if exists passports_customer_org_check on public.passports;
create trigger passports_customer_org_check
  before insert or update of org_id, customer_id on public.passports
  for each row execute function public.enforce_passport_customer_org();

create or replace function public.passports_single_current()
returns trigger
language plpgsql
as $$
begin
  if new.is_current then
    update public.passports
    set is_current = false
    where customer_id = new.customer_id
      and id is distinct from new.id
      and is_current;
  end if;
  return new;
end;
$$;

drop trigger if exists passports_single_current_trg on public.passports;
create trigger passports_single_current_trg
  before insert or update of is_current, customer_id on public.passports
  for each row execute function public.passports_single_current();

-- ---------------------------------------------------------------------------
-- Backfill one current passport per existing customer
-- ---------------------------------------------------------------------------
insert into public.passports (
  org_id,
  customer_id,
  passport_number,
  passport_expiry,
  is_current,
  created_at
)
select
  c.org_id,
  c.id,
  case
    when exists (
      select 1
      from public.customers earlier
      where earlier.org_id = c.org_id
        and lower(trim(earlier.passport_number)) = lower(trim(c.passport_number))
        and earlier.id < c.id
    ) then trim(c.passport_number) || '-' || substr(replace(c.id::text, '-', ''), 1, 8)
    else trim(c.passport_number)
  end,
  c.passport_expiry,
  true,
  c.created_at
from public.customers c;

-- ---------------------------------------------------------------------------
-- Visas remember the booklet used
-- ---------------------------------------------------------------------------
alter table public.visas
  add column passport_id uuid references public.passports (id) on delete restrict;

create index visas_passport_id_idx on public.visas (passport_id);

update public.visas v
set passport_id = p.id
from public.passports p
where p.customer_id = v.customer_id;

alter table public.visas
  alter column passport_id set not null;

create or replace function public.enforce_visa_passport()
returns trigger
language plpgsql
as $$
declare
  passport_customer uuid;
begin
  select p.customer_id into passport_customer
  from public.passports p
  where p.id = new.passport_id;

  if passport_customer is null then
    raise exception 'Passport not found';
  end if;

  if passport_customer is distinct from new.customer_id then
    raise exception 'Passport must belong to the visa customer';
  end if;

  return new;
end;
$$;

drop trigger if exists visas_passport_check on public.visas;
create trigger visas_passport_check
  before insert or update of customer_id, passport_id on public.visas
  for each row execute function public.enforce_visa_passport();

-- ---------------------------------------------------------------------------
-- Customers no longer store a single passport
-- ---------------------------------------------------------------------------
drop index if exists public.customers_passport_expiry_idx;

alter table public.customers
  drop column passport_number,
  drop column passport_expiry;

-- Delete visas before passports so passport_id RESTRICT does not block customer delete
create or replace function public.customers_delete_visas_first()
returns trigger
language plpgsql
as $$
begin
  delete from public.visas where customer_id = old.id;
  return old;
end;
$$;

drop trigger if exists customers_delete_visas_first on public.customers;
create trigger customers_delete_visas_first
  before delete on public.customers
  for each row execute function public.customers_delete_visas_first();

-- ---------------------------------------------------------------------------
-- Merge confirmed duplicate customers onto one survivor
-- ---------------------------------------------------------------------------
create or replace function public.merge_customers(
  keep_id uuid,
  absorb_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_org uuid;
  keep_phone text;
  absorb_org uuid;
  absorb_id uuid;
  in_progress_count integer;
  winner_id uuid;
  extra_visas integer;
  extra_extensions integer;
  extra_phone text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if keep_id is null then
    raise exception 'keep_id is required';
  end if;

  if absorb_ids is null or cardinality(absorb_ids) = 0 then
    raise exception 'absorb_ids must not be empty';
  end if;

  if keep_id = any (absorb_ids) then
    raise exception 'Cannot merge a customer into itself';
  end if;

  select c.org_id, c.contact_number
  into keep_org, keep_phone
  from public.customers c
  where c.id = keep_id;

  if keep_org is null then
    raise exception 'Customer to keep was not found';
  end if;

  foreach absorb_id in array absorb_ids loop
    select c.org_id into absorb_org
    from public.customers c
    where c.id = absorb_id;

    if absorb_org is null then
      raise exception 'Customer to absorb was not found';
    end if;

    if absorb_org is distinct from keep_org then
      raise exception 'Customers must belong to the same organization';
    end if;
  end loop;

  select count(*)::integer into in_progress_count
  from public.visas v
  where v.status = 'In-Progress'
    and (v.customer_id = keep_id or v.customer_id = any (absorb_ids));

  if in_progress_count > 1 then
    raise exception 'IN_PROGRESS_CONFLICT'
      using hint = 'Finish or archive extra In-Progress visas before merging.';
  end if;

  select p.id into winner_id
  from public.passports p
  where p.customer_id = keep_id
     or p.customer_id = any (absorb_ids)
  order by
    p.passport_expiry desc,
    case when p.customer_id = keep_id then 0 else 1 end,
    p.created_at desc
  limit 1;

  update public.passports
  set is_current = false
  where customer_id = any (absorb_ids)
    and is_current;

  update public.passports
  set customer_id = keep_id
  where customer_id = any (absorb_ids);

  update public.visas
  set customer_id = keep_id
  where customer_id = any (absorb_ids);

  select
    coalesce(sum(c.visa_count), 0)::integer,
    coalesce(sum(c.extension_count), 0)::integer
  into extra_visas, extra_extensions
  from public.customers c
  where c.id = any (absorb_ids);

  select c.contact_number into extra_phone
  from public.customers c
  where c.id = any (absorb_ids)
    and length(trim(c.contact_number)) > 0
  order by c.created_at desc
  limit 1;

  update public.customers
  set
    visa_count = visa_count + extra_visas,
    extension_count = extension_count + extra_extensions,
    contact_number = case
      when length(trim(contact_number)) > 0 then contact_number
      else coalesce(extra_phone, contact_number)
    end
  where id = keep_id;

  if winner_id is not null then
    update public.passports
    set is_current = false
    where customer_id = keep_id
      and is_current
      and id is distinct from winner_id;

    update public.passports
    set is_current = true
    where id = winner_id;
  end if;

  delete from public.customers
  where id = any (absorb_ids);

  return keep_id;
end;
$$;

revoke all on function public.merge_customers(uuid, uuid[]) from public;
grant execute on function public.merge_customers(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.passports enable row level security;

create policy "passports_select_authenticated"
  on public.passports for select
  to authenticated
  using (true);

create policy "passports_insert_authenticated"
  on public.passports for insert
  to authenticated
  with check (true);

create policy "passports_update_authenticated"
  on public.passports for update
  to authenticated
  using (true);

create policy "passports_delete_authenticated"
  on public.passports for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.passports to authenticated;

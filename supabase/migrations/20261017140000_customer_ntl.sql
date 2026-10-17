-- Per-customer NTL flag. Dashboard counts customers where this is true.

alter table public.customers
  add column ntl boolean not null default false;

create index customers_ntl_idx on public.customers (ntl) where ntl;

-- Keep NTL when duplicate customers are merged.
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
    end,
    ntl = ntl or exists (
      select 1
      from public.customers absorbed
      where absorbed.id = any (absorb_ids)
        and absorbed.ntl
    )
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

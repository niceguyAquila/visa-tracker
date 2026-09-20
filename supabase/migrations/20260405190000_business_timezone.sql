-- "Today" follows Kuala Lumpur, where the business operates. Under UTC a visa
-- stayed In-Progress until 08:00 local on the day after its leave date.

create or replace function public.business_today()
returns date
language sql
stable
as $$
  select (timezone('Asia/Kuala_Lumpur', now()))::date;
$$;

grant execute on function public.business_today() to authenticated;

create or replace function public.set_actual_leave_date_on_finished()
returns trigger
language plpgsql
as $$
begin
  if new.cycle_done and new.actual_leave_date is null then
    new.actual_leave_date := public.business_today();
  end if;
  return new;
end;
$$;

create or replace function public.finish_due_visas()
returns integer
language plpgsql
as $$
declare
  finished integer;
begin
  update public.visas
  set cycle_done = true
  where status = 'In-Progress'
    and actual_leave_date is not null
    and actual_leave_date <= public.business_today();

  get diagnostics finished = row_count;
  return finished;
end;
$$;

-- pg_cron runs on UTC, so 16:10 UTC is 00:10 the next day in Kuala Lumpur.
-- Rescheduling by the same job name replaces the previous entry.
do $$
begin
  perform cron.schedule(
    'finish-due-visas',
    '10 16 * * *',
    'select public.finish_due_visas();'
  );
exception
  when others then
    raise notice 'pg_cron unavailable; relying on app-triggered sweep.';
end;
$$;

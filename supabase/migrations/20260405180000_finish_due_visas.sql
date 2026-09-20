-- Auto-finish visas once their confirmed leave date has passed.
-- Only In-Progress visas are swept, so Cuti and Blacklist keep their status.

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
    and actual_leave_date <= (timezone('utc', now()))::date;

  get diagnostics finished = row_count;
  return finished;
end;
$$;

grant execute on function public.finish_due_visas() to authenticated;

-- Nightly sweep when pg_cron is available. The app also calls the function on
-- load, so the schedule is a convenience rather than a requirement.
do $$
begin
  perform cron.schedule(
    'finish-due-visas',
    '10 0 * * *',
    'select public.finish_due_visas();'
  );
exception
  when others then
    raise notice 'pg_cron unavailable; relying on app-triggered sweep.';
end;
$$;

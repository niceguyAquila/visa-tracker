-- Allow a confirmed future leave date while the visa is still In-Progress.
-- Finishing still defaults the date to today when none was recorded.

alter table public.visas
  drop constraint if exists visas_actual_leave_date_finished_chk;

create or replace function public.set_actual_leave_date_on_finished()
returns trigger
language plpgsql
as $$
begin
  if new.cycle_done and new.actual_leave_date is null then
    new.actual_leave_date := (timezone('utc', now()))::date;
  end if;
  return new;
end;
$$;

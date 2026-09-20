-- Record when the customer actually left. Planned leave stays on leave_date_reminder.

alter table public.visas
  add column actual_leave_date date;

create index visas_actual_leave_date_idx on public.visas (actual_leave_date);

alter table public.visas
  add constraint visas_actual_leave_date_finished_chk
  check (cycle_done or actual_leave_date is null);

alter table public.visas
  add constraint visas_actual_leave_date_after_entry_chk
  check (
    actual_leave_date is null
    or date_entered is null
    or actual_leave_date >= date_entered
  );

create or replace function public.set_actual_leave_date_on_finished()
returns trigger
language plpgsql
as $$
begin
  if new.cycle_done then
    if new.actual_leave_date is null
       and (tg_op = 'INSERT' or not coalesce(old.cycle_done, false))
    then
      new.actual_leave_date := (timezone('utc', now()))::date;
    end if;
  else
    new.actual_leave_date := null;
  end if;
  return new;
end;
$$;

drop trigger if exists visas_actual_leave_date_on_finished on public.visas;
create trigger visas_actual_leave_date_on_finished
  before insert or update of cycle_done, actual_leave_date on public.visas
  for each row execute function public.set_actual_leave_date_on_finished();

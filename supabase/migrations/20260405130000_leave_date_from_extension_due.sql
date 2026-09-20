-- Leave-by is 60 days after extension due (date entered + visa days + 60).

drop index if exists public.visas_leave_date_reminder_idx;

alter table public.visas
  drop column if exists leave_date_reminder;

alter table public.visas
  add column leave_date_reminder date generated always as (
    case visa_days
      when '90 Days' then date_entered + 150
      when '30 Days' then date_entered + 90
    end
  ) stored;

create index visas_leave_date_reminder_idx on public.visas (leave_date_reminder);

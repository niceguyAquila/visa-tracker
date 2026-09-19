-- Extend-by: 90 Days → date_entered + 90, 30 Days → date_entered + 30
-- Leave-by: date_extended + 60

drop index if exists public.visas_date_to_extension_idx;
drop index if exists public.visas_leave_date_reminder_idx;

alter table public.visas drop column if exists date_to_extension;
alter table public.visas drop column if exists leave_date_reminder;

alter table public.visas
  add column date_to_extension date generated always as (
    case visa_days
      when '90 Days' then date_entered + 90
      when '30 Days' then date_entered + 30
    end
  ) stored;

alter table public.visas
  add column leave_date_reminder date generated always as (
    case when date_extended is not null then date_extended + 60 end
  ) stored;

create index visas_date_to_extension_idx on public.visas (date_to_extension);
create index visas_leave_date_reminder_idx on public.visas (leave_date_reminder);

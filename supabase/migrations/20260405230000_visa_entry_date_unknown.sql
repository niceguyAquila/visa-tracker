-- Arrived without a known entry date. Extension dates stay null until date_entered is set.

alter table public.visas
  add column if not exists entry_date_unknown boolean not null default false;

-- Customer employment status. Currently Not Working people stay in the app
-- but are excluded from the Dashboard Customers count.

alter table public.customers
  add column status text not null default 'Working'
  constraint customers_status_check
    check (status in ('Working', 'Currently Not Working'));

create index customers_status_idx on public.customers (status);

-- Allow preparing a visa before the customer has entered.
-- date_to_extension stays generated: NULL + interval is NULL.

alter table public.visas
  alter column date_entered drop not null;

-- Exit port for a visa cycle, alongside the existing entry Route.

alter table public.visas
  add column if not exists exit_route text not null default '';

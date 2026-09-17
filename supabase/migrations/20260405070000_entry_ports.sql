-- Org-scoped custom Masuk Dari / port-of-entry options (defaults live in app code)

create table public.entry_ports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint entry_ports_name_not_blank check (length(trim(name)) > 0)
);

create index entry_ports_org_id_idx on public.entry_ports (org_id);
create unique index entry_ports_org_id_lower_name_uidx
  on public.entry_ports (org_id, lower(name));

alter table public.entry_ports enable row level security;

create policy "entry_ports_select_authenticated"
  on public.entry_ports for select
  to authenticated
  using (true);

create policy "entry_ports_insert_authenticated"
  on public.entry_ports for insert
  to authenticated
  with check (true);

create policy "entry_ports_update_authenticated"
  on public.entry_ports for update
  to authenticated
  using (true);

create policy "entry_ports_delete_authenticated"
  on public.entry_ports for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.entry_ports to authenticated;

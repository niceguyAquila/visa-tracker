-- Fix infinite recursion: policies on organization_members must not
-- SELECT organization_members under RLS. Use a security-definer helper.

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = p_org_id
      and om.user_id = auth.uid()
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated, anon;

create or replace function public.is_worker_org_member(p_worker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workers w
    join public.organization_members om on om.org_id = w.org_id
    where w.id = p_worker_id
      and om.user_id = auth.uid()
  );
$$;

revoke all on function public.is_worker_org_member(uuid) from public;
grant execute on function public.is_worker_org_member(uuid) to authenticated, anon;

-- Organizations
drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  using (public.is_org_member(id));

-- Organization members (this was the recursive policy)
drop policy if exists "org_members_select" on public.organization_members;
create policy "org_members_select"
  on public.organization_members for select
  using (public.is_org_member(org_id));

-- Workers
drop policy if exists "workers_select" on public.workers;
drop policy if exists "workers_insert" on public.workers;
drop policy if exists "workers_update" on public.workers;
drop policy if exists "workers_delete" on public.workers;

create policy "workers_select"
  on public.workers for select
  using (public.is_org_member(org_id));

create policy "workers_insert"
  on public.workers for insert
  with check (public.is_org_member(org_id));

create policy "workers_update"
  on public.workers for update
  using (public.is_org_member(org_id));

create policy "workers_delete"
  on public.workers for delete
  using (public.is_org_member(org_id));

-- Visa records
drop policy if exists "visas_select" on public.visa_records;
drop policy if exists "visas_insert" on public.visa_records;
drop policy if exists "visas_update" on public.visa_records;
drop policy if exists "visas_delete" on public.visa_records;

create policy "visas_select"
  on public.visa_records for select
  using (public.is_worker_org_member(worker_id));

create policy "visas_insert"
  on public.visa_records for insert
  with check (public.is_worker_org_member(worker_id));

create policy "visas_update"
  on public.visa_records for update
  using (public.is_worker_org_member(worker_id));

create policy "visas_delete"
  on public.visa_records for delete
  using (public.is_worker_org_member(worker_id));

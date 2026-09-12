-- Visa Tracker: org-scoped workers + visas, invite-only signup via trigger

create extension if not exists "pgcrypto";

-- Organizations (invite_code is shared with managers to onboard)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

-- Mirrors auth.users for RLS-friendly joins + email visibility in Edge Functions
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  primary key (org_id, user_id)
);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  employer_ref text,
  notes text,
  created_at timestamptz not null default now()
);

create index workers_org_id_idx on public.workers (org_id);

create table public.visa_records (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers (id) on delete cascade,
  visa_label text not null default 'Visa',
  issue_date date,
  expiry_date date not null,
  extension_deadline date,
  notes text,
  reminder_10d_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index visa_records_worker_id_idx on public.visa_records (worker_id);
create index visa_records_expiry_idx on public.visa_records (expiry_date);

-- New signups must supply raw_user_meta_data.invite_code matching organizations.invite_code
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite text;
  org uuid;
begin
  invite := lower(trim(coalesce(new.raw_user_meta_data->>'invite_code', '')));
  if invite = '' then
    raise exception 'Invite code is required';
  end if;

  select o.id into org
  from public.organizations o
  where lower(o.invite_code) = invite;

  if org is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.profiles (id, email)
  values (new.id, new.email);

  insert into public.organization_members (org_id, user_id, role)
  values (org, new.id, 'member');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Reset D-10 flag when expiry changes (managers may correct dates)
create or replace function public.reset_visa_reminder_on_expiry_change()
returns trigger
language plpgsql
as $$
begin
  if new.expiry_date is distinct from old.expiry_date then
    new.reminder_10d_sent := false;
  end if;
  return new;
end;
$$;

drop trigger if exists visa_expiry_changed on public.visa_records;
create trigger visa_expiry_changed
  before update of expiry_date on public.visa_records
  for each row execute function public.reset_visa_reminder_on_expiry_change();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.workers enable row level security;
alter table public.visa_records enable row level security;

-- Profiles
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

-- Organizations visible to members
create policy "organizations_select_member"
  on public.organizations for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = organizations.id and om.user_id = auth.uid()
    )
  );

-- Members list (same org)
create policy "org_members_select"
  on public.organization_members for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = organization_members.org_id and om.user_id = auth.uid()
    )
  );

-- Workers
create policy "workers_select"
  on public.workers for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = workers.org_id and om.user_id = auth.uid()
    )
  );

create policy "workers_insert"
  on public.workers for insert
  with check (
    exists (
      select 1 from public.organization_members om
      where om.org_id = workers.org_id and om.user_id = auth.uid()
    )
  );

create policy "workers_update"
  on public.workers for update
  using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = workers.org_id and om.user_id = auth.uid()
    )
  );

create policy "workers_delete"
  on public.workers for delete
  using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = workers.org_id and om.user_id = auth.uid()
    )
  );

-- Visa records (via worker org)
create policy "visas_select"
  on public.visa_records for select
  using (
    exists (
      select 1
      from public.workers w
      join public.organization_members om on om.org_id = w.org_id
      where w.id = visa_records.worker_id and om.user_id = auth.uid()
    )
  );

create policy "visas_insert"
  on public.visa_records for insert
  with check (
    exists (
      select 1
      from public.workers w
      join public.organization_members om on om.org_id = w.org_id
      where w.id = visa_records.worker_id and om.user_id = auth.uid()
    )
  );

create policy "visas_update"
  on public.visa_records for update
  using (
    exists (
      select 1
      from public.workers w
      join public.organization_members om on om.org_id = w.org_id
      where w.id = visa_records.worker_id and om.user_id = auth.uid()
    )
  );

create policy "visas_delete"
  on public.visa_records for delete
  using (
    exists (
      select 1
      from public.workers w
      join public.organization_members om on om.org_id = w.org_id
      where w.id = visa_records.worker_id and om.user_id = auth.uid()
    )
  );

-- Demo org (change invite_code in dashboard after first deploy)
insert into public.organizations (name, invite_code)
values ('Default team', 'demo-invite-2026');

-- Admins-only app: any authenticated user can manage data.
-- Customers/workers never log in; org membership RLS is unnecessary.

-- Organizations
drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_authenticated"
  on public.organizations for select
  to authenticated
  using (true);

-- Companies
drop policy if exists "companies_select" on public.companies;
drop policy if exists "companies_insert" on public.companies;
drop policy if exists "companies_update" on public.companies;
drop policy if exists "companies_delete" on public.companies;

create policy "companies_select_authenticated"
  on public.companies for select
  to authenticated
  using (true);

create policy "companies_insert_authenticated"
  on public.companies for insert
  to authenticated
  with check (true);

create policy "companies_update_authenticated"
  on public.companies for update
  to authenticated
  using (true);

create policy "companies_delete_authenticated"
  on public.companies for delete
  to authenticated
  using (true);

-- Customers
drop policy if exists "customers_select" on public.customers;
drop policy if exists "customers_insert" on public.customers;
drop policy if exists "customers_update" on public.customers;
drop policy if exists "customers_delete" on public.customers;

create policy "customers_select_authenticated"
  on public.customers for select
  to authenticated
  using (true);

create policy "customers_insert_authenticated"
  on public.customers for insert
  to authenticated
  with check (true);

create policy "customers_update_authenticated"
  on public.customers for update
  to authenticated
  using (true);

create policy "customers_delete_authenticated"
  on public.customers for delete
  to authenticated
  using (true);

grant select on public.organizations to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.customers to authenticated;

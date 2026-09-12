-- Fix org membership visibility + grants for companies/customers

-- Allow users to always read their own membership row (no recursion).
-- Keep peer visibility via is_org_member for listing other members in the same org.
drop policy if exists "org_members_select" on public.organization_members;

create policy "org_members_select_own"
  on public.organization_members for select
  using (user_id = auth.uid());

create policy "org_members_select_peers"
  on public.organization_members for select
  using (public.is_org_member(org_id));

-- Ensure API roles can use the new tables (needed if migration was run manually)
grant select, insert, update, delete on public.companies to authenticated, anon;
grant select, insert, update, delete on public.customers to authenticated, anon;

grant execute on function public.is_org_member(uuid) to authenticated, anon;
grant execute on function public.is_customer_org_member(uuid) to authenticated, anon;

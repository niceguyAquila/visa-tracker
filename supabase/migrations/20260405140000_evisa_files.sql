-- Store the original e-visa PDF alongside the text snapshot.

alter table public.e_visas
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists content_type text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'e-visas',
  'e-visas',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "e_visas_storage_select" on storage.objects;
create policy "e_visas_storage_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'e-visas');

drop policy if exists "e_visas_storage_insert" on storage.objects;
create policy "e_visas_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'e-visas');

drop policy if exists "e_visas_storage_update" on storage.objects;
create policy "e_visas_storage_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'e-visas');

drop policy if exists "e_visas_storage_delete" on storage.objects;
create policy "e_visas_storage_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'e-visas');

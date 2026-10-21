-- One passport photo per customer. The row stores a path, not the image bytes.
-- The customer list does not request a signed URL or render the file.

alter table public.customers
  add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'passport-photos',
  'passport-photos',
  false,
  2097152,
  array['image/jpeg']
)
on conflict (id) do nothing;

drop policy if exists "passport_photos_storage_select" on storage.objects;
create policy "passport_photos_storage_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'passport-photos');

drop policy if exists "passport_photos_storage_insert" on storage.objects;
create policy "passport_photos_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'passport-photos');

drop policy if exists "passport_photos_storage_update" on storage.objects;
create policy "passport_photos_storage_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'passport-photos');

drop policy if exists "passport_photos_storage_delete" on storage.objects;
create policy "passport_photos_storage_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'passport-photos');

-- =====================================================================================
-- Mukana · 0003 · Storage buckets and owner policies
-- Object path convention: <owner folder>/<filename>
--   cvs, placement-letters, avatars         -> <user id>/...
--   company-logos, verification-docs        -> <company id>/...
-- Bucket-level limits are enforced by Storage itself (size + MIME), in addition to the
-- client checks and the server-side magic-byte check performed by the app after upload.
-- =====================================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cvs',               'cvs',               false, 5242880, array['application/pdf']),
  ('placement-letters', 'placement-letters', false, 5242880, array['application/pdf']),
  ('avatars',           'avatars',           false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('company-logos',     'company-logos',     true,  1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-docs', 'verification-docs', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---- candidate-owned private buckets: full control of own folder only
create policy "cvs owner all" on storage.objects for all to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "placement letters owner all" on storage.objects for all to authenticated
  using (bucket_id = 'placement-letters' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'placement-letters' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner all" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- company logos: public read, only the owning employer writes
create policy "company logos public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'company-logos');
create policy "company logos owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = public.my_company_id()::text);
create policy "company logos owner update" on storage.objects for update to authenticated
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = public.my_company_id()::text);
create policy "company logos owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = public.my_company_id()::text);

-- ---- verification documents: owning employer + admins can read; employer writes
create policy "verification docs owner all" on storage.objects for all to authenticated
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = public.my_company_id()::text)
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = public.my_company_id()::text);
create policy "verification docs admin read" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and public.is_admin());

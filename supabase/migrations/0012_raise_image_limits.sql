-- =====================================================================================
-- Mukana · 0012 · Accept photos up to 25MB (the app shrinks them in the browser before upload)
-- Photos: avatars, company logos and verification documents now allow 25MB at bucket level.
-- PDFs stay limited to 5MB by the app. Videos in post-media stay at 30MB.
-- (Supabase's project-wide maximum upload size must be at least 25MB; the free plan allows 50MB.)
-- =====================================================================================
update storage.buckets set file_size_limit = 26214400 where id in ('avatars', 'company-logos', 'verification-docs');
update storage.buckets set file_size_limit = 31457280 where id = 'post-media';
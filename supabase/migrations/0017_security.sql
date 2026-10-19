-- =====================================================================================
-- Mukana · 0017 · Two-step verification (TOTP) enforcement in the database
--
-- A member who turned on two-step verification must prove the second step before the database serves
-- their data: a session that only completed the password step (JWT "aal1") is treated like a locked account.
-- Members without a verified factor are unaffected.
-- =====================================================================================

create or replace function public.aal_ok()
returns boolean language plpgsql stable security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then return true; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then return true; end if;
  if to_regclass('auth.mfa_factors') is null then return true; end if;
  return not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified');
end $$;

-- Almost every function and policy asks is_active_user() first, so this one change covers them.
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce((select p.status = 'active' from public.profiles p where p.id = auth.uid()), false) and public.aal_ok()
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'candidate_profiles', 'company_private', 'verification_requests', 'applications', 'application_events',
    'interviews', 'notifications', 'device_tokens', 'notification_preferences', 'messages', 'conversation_members',
    'connections', 'follows', 'blocks', 'recommendations', 'skill_endorsements', 'saved_opportunities', 'saved_candidates',
    'job_alerts', 'posts', 'post_comments', 'post_likes', 'post_bookmarks', 'quiz_attempts', 'user_badges',
    'mentorship_requests', 'event_rsvps', 'group_members', 'company_members', 'message_templates'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists mfa_gate on public.%I', t);
      execute format('create policy mfa_gate on public.%I as restrictive for all to authenticated using (public.aal_ok()) with check (public.aal_ok())', t);
    end if;
  end loop;
end $$;

-- Private files (CVs, placement letters, photos, verification documents) follow the same rule.
drop policy if exists mfa_gate on storage.objects;
create policy mfa_gate on storage.objects as restrictive for all to authenticated
  using (bucket_id in ('post-media', 'company-logos') or public.aal_ok())
  with check (bucket_id in ('post-media', 'company-logos') or public.aal_ok());

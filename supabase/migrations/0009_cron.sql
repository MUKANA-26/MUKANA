-- =====================================================================================
-- Mukana · 0009 · Scheduled jobs (pg_cron + pg_net -> Edge Functions)
--
-- After the Edge Functions are deployed, store where they live and the shared secret ONCE:
--
--   insert into public.app_config (key, value) values
--     ('edge_base_url', 'https://<PROJECT-REF>.supabase.co/functions/v1'),
--     ('cron_secret',   '<the same value as the CRON_SECRET Edge Function secret>')
--   on conflict (key) do update set value = excluded.value;
--
-- Until that row exists the jobs below simply do nothing.
-- =====================================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.call_edge_function(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from public.app_config where key = 'edge_base_url';
  select value into v_secret from public.app_config where key = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end $$;
revoke all on function public.call_edge_function(text) from public, anon, authenticated;

-- Zimbabwe is UTC+2 all year. cron runs in UTC.
-- Safety-net delivery of any notification the instant trigger missed.
select cron.schedule('mukana-send-notifications', '*/5 * * * *', $$select public.call_edge_function('send-notifications')$$);
-- Deadline reminders (3 days and 1 day before) every morning at 08:00 Harare.
select cron.schedule('mukana-deadline-reminders', '0 6 * * *', $$select public.call_edge_function('deadline-reminders')$$);
-- Interview reminders (24h before): hourly.
select cron.schedule('mukana-interview-reminders', '10 * * * *', $$select public.call_edge_function('interview-reminders')$$);
-- Close opportunities whose deadline passed: just after midnight Harare.
select cron.schedule('mukana-close-expired', '5 22 * * *', $$select public.call_edge_function('close-expired-opportunities')$$);

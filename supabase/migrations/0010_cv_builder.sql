-- =====================================================================================
-- Mukana · 0010 · CV builder drafts
-- The generated PDFs themselves live in the private `cvs` bucket (<user id>/cv_builder-*.pdf).
-- =====================================================================================

create table public.cv_drafts (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  template   text not null default 'classic' check (template in ('classic', 'modern')),
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 60000),
  updated_at timestamptz not null default now()
);
create trigger cv_drafts_updated before update on public.cv_drafts
  for each row execute function public.set_updated_at();

alter table public.cv_drafts enable row level security;
create policy cv_drafts_own on public.cv_drafts for all to authenticated
  using (user_id = auth.uid() and public.my_role() = 'candidate')
  with check (user_id = auth.uid() and public.my_role() = 'candidate');

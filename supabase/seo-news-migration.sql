-- Run once in Supabase SQL Editor before deploying this version.
alter table public.services add column if not exists tags text[] not null default '{}';
alter table public.settings add column if not exists jobs_url text not null default 'https://www.naukriexpress.space/';

create table if not exists public.news (
  id text primary key,
  title text not null,
  summary text not null default '',
  body text not null default '',
  source_url text not null default '',
  published_at timestamptz not null default now()
);
alter table public.news enable row level security;
drop policy if exists "public read news" on public.news;
drop policy if exists "admin news" on public.news;
create policy "public read news" on public.news for select to anon, authenticated using (true);
create policy "admin news" on public.news for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

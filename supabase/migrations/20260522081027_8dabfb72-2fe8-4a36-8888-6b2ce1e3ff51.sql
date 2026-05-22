create table public.user_logins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  login_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, login_date)
);

create index user_logins_user_date_idx on public.user_logins (user_id, login_date desc);

alter table public.user_logins enable row level security;

create policy "Users insert own logins" on public.user_logins
  for insert to authenticated with check (auth.uid() = user_id);

create policy "Users view own logins" on public.user_logins
  for select to authenticated using (auth.uid() = user_id);

create policy "Admins manage logins" on public.user_logins
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));
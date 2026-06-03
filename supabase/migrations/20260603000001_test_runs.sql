-- Test runs: each labeled QA session created by a tester account.
create table if not exists test_runs (
  id          uuid primary key default gen_random_uuid(),
  tester_id   uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  created_at  timestamptz not null default now(),
  completed_at timestamptz
);

-- Test run results: one row per test case per run (upserted as tester works through the list).
create table if not exists test_run_results (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references test_runs(id) on delete cascade,
  test_id    text not null,
  status     text not null default 'untested'
               check (status in ('untested', 'pass', 'fail', 'blocked', 'skipped')),
  notes      text,
  updated_at timestamptz not null default now(),
  unique(run_id, test_id)
);

alter table test_runs        enable row level security;
alter table test_run_results enable row level security;

-- Testers own their runs.
create policy "tester_owns_run" on test_runs
  for all using (auth.uid() = tester_id);

-- Admins can read all runs for the results dashboard.
create policy "admin_read_runs" on test_runs
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Testers can read/write results for their own runs.
create policy "tester_owns_results" on test_run_results
  for all using (
    exists (select 1 from test_runs where id = run_id and tester_id = auth.uid())
  );

-- Admins can read all results.
create policy "admin_read_results" on test_run_results
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

create index if not exists test_runs_tester_idx    on test_runs(tester_id);
create index if not exists test_results_run_idx    on test_run_results(run_id);
create index if not exists test_results_status_idx on test_run_results(status);

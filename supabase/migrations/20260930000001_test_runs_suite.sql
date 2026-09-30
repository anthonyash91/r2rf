-- Which checklist a run was created against: the full 342-item QA suite, or
-- the short "User Experience Check" (user/inmate-facing flows only). Existing
-- runs predate this column and always used the full suite.
alter table test_runs
  add column if not exists suite text not null default 'full'
    check (suite in ('full', 'quick'));

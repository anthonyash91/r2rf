-- Add screenshot_url to test_run_results so testers can attach failure screenshots.
alter table test_run_results
  add column if not exists screenshot_url text;

create table if not exists content_item_facilities (
  content_item_id uuid not null references content_items(id) on delete cascade,
  facility_value text not null,
  primary key (content_item_id, facility_value)
);

alter table content_item_facilities enable row level security;

-- Public read — needed for the public category page (anon client)
create policy "Public read content_item_facilities"
  on content_item_facilities for select
  to anon, authenticated
  using (true);

-- Admins and contributors can insert
create policy "Admin contributor insert content_item_facilities"
  on content_item_facilities for insert
  to authenticated
  with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
        and role in ('admin', 'contributor')
    )
  );

-- Admins and contributors can delete
create policy "Admin contributor delete content_item_facilities"
  on content_item_facilities for delete
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
        and role in ('admin', 'contributor')
    )
  );

-- Create a table for global application settings
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table app_settings enable row level security;

-- Policy: Allow authenticated users to view settings
create policy "Authenticated users can view settings"
  on app_settings for select
  to authenticated
  using (true);

-- Policy: Allow authenticated users to insert/update settings
-- Note: In a stricter app you might restrict this to admins, but for this requirement:
create policy "Authenticated users can update settings"
  on app_settings for all
  to authenticated
  using (true)
  with check (true);

-- Insert default empty config if not exists (optional, helps avoid 404s on first load)
insert into app_settings (key, value)
values ('pdf_global_config', '{}'::jsonb)
on conflict (key) do nothing;

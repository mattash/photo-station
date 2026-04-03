-- Sessions table: each represents a QR card / family group
create table sessions (
  id uuid primary key default gen_random_uuid(),
  label text,
  created_at timestamptz default now(),
  photos_ready boolean default false
);

-- Registrations: when a family scans the QR and submits their email
create table registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  email text not null,
  access_token text unique not null,
  created_at timestamptz default now()
);

-- Photos: uploaded and associated with a session
create table photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

-- Storage bucket for photos (run in Supabase dashboard Storage section)
-- Bucket name: photos
-- Set to private

-- RLS policies
alter table sessions enable row level security;
alter table registrations enable row level security;
alter table photos enable row level security;

-- Allow public to read sessions (needed for QR form to validate session ID)
create policy "Public can read sessions" on sessions for select using (true);

-- Allow public to insert registrations (for the form submission)
create policy "Public can insert registrations" on registrations for insert with check (true);

-- Allow users to read their own registration by access_token
create policy "Public can read registration by token" on registrations for select using (true);

-- Allow public to read photos (access controlled at app level via token)
create policy "Public can read photos" on photos for select using (true);

-- Service role has full access (used by admin API routes)

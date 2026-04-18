-- Schema for the Zombie Brand Scout
-- Run this in the Supabase SQL editor (or via supabase CLI).

-- IPGOD-style trademark data, sourced from IP Australia's open data.
-- For a test run, load the bundled seed.sql to populate a handful of rows.
-- For production, import the IPGOD trademark CSV
-- (https://data.gov.au/dataset/intellectual-property-government-open-data)
-- into this table.
create table if not exists public.ipgod_trademarks (
  id bigint generated always as identity primary key,
  tm_number text,
  word text not null,
  lodgement_date date,
  status text,
  nice_classes integer[] not null default '{}'
);

create index if not exists ipgod_trademarks_lodgement_date_idx
  on public.ipgod_trademarks (lodgement_date);
create index if not exists ipgod_trademarks_status_idx
  on public.ipgod_trademarks (status);
create index if not exists ipgod_trademarks_nice_classes_idx
  on public.ipgod_trademarks using gin (nice_classes);

alter table public.ipgod_trademarks enable row level security;

-- Allow anonymous (publishable-key) reads for the scout.
drop policy if exists "ipgod_trademarks read" on public.ipgod_trademarks;
create policy "ipgod_trademarks read"
  on public.ipgod_trademarks for select
  to anon, authenticated
  using (true);

-- Enriched survivors land here.
create table if not exists public.zombie_brands_au (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  nice_class integer not null,
  decade text not null,
  lodgement_start date not null,
  lodgement_end date not null,
  aesthetic_score numeric,
  mood_board_prompt text,
  created_at timestamptz not null default now(),
  unique (word, nice_class)
);

alter table public.zombie_brands_au enable row level security;

-- Allow anonymous inserts so the scout route (using the publishable key) can write.
drop policy if exists "zombie_brands_au insert" on public.zombie_brands_au;
create policy "zombie_brands_au insert"
  on public.zombie_brands_au for insert
  to anon, authenticated
  with check (true);

drop policy if exists "zombie_brands_au read" on public.zombie_brands_au;
create policy "zombie_brands_au read"
  on public.zombie_brands_au for select
  to anon, authenticated
  using (true);

-- Schema for the Zombie Brand Scout
-- Run this in the Supabase SQL editor (or via supabase CLI).

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

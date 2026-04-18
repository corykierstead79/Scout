-- Import IP RAPID CSVs (trademark subset) and transform into ipgod_trademarks.
-- Run this in the Supabase SQL editor AFTER schema.sql.
--
-- Workflow:
--   1. Run section A below to create the three raw staging tables.
--   2. Import the three IP RAPID CSVs into those tables via Supabase Table
--      Editor → <table> → Import → Upload CSV. If the files are too large for
--      the browser uploader, use `psql \copy` or the Supabase CLI instead.
--   3. Run section B to find the exact `description_type` that holds the
--      word mark text (column values vary between IP RAPID releases).
--   4. Edit section C if needed, then run it to populate ipgod_trademarks.

-- ============================================================
-- A. Raw staging tables mirroring the IP RAPID CSV columns.
-- ============================================================

drop table if exists public.rapid_application_raw cascade;
create table public.rapid_application_raw (
  ip_right_type text,
  application_number text,
  ip_right_sub_type text,
  status text,
  application_date date,
  earliest_filed_date date,
  priority_date date,
  gained_registration_status_date date,
  gained_enforceable_status_date date,
  enforceable_from_date date,
  deemed_retired_date date
);

drop table if exists public.rapid_classification_raw cascade;
create table public.rapid_classification_raw (
  ip_right_type text,
  application_number text,
  classification_system text,
  classification text,
  classification_importance text,
  classification_inventiveness text,
  classification_source text,
  classifying_country_code text,
  classification_date date,
  classification_removal_date date,
  classification_system_version text,
  is_current boolean,
  classification_area text,
  coarse_classification_area text
);

drop table if exists public.rapid_description_raw cascade;
create table public.rapid_description_raw (
  ip_right_type text,
  application_number text,
  description_type text,
  description_value text
);

-- ============================================================
-- B. Diagnostic: find which description_type holds the word mark.
--    Run this after importing the description CSV and pick the
--    type that looks like the brand text (often 'Words' or similar).
-- ============================================================

-- select description_type, count(*) as n
-- from public.rapid_description_raw
-- where ip_right_type = 'TM'
-- group by description_type
-- order by n desc;

-- ============================================================
-- C. Transform: populate ipgod_trademarks from the raw tables.
--    Replace WORD_DESCRIPTION_TYPE with the value you found in B
--    (default guess: 'Words').
-- ============================================================

truncate public.ipgod_trademarks restart identity;

insert into public.ipgod_trademarks (tm_number, word, lodgement_date, status, nice_classes)
select
  a.application_number,
  d.description_value,
  a.application_date,
  a.status,
  coalesce(
    (
      select array_agg(distinct c.classification::int order by c.classification::int)
      from public.rapid_classification_raw c
      where c.application_number = a.application_number
        and c.ip_right_type = 'TM'
        and c.classification_system = 'NICE'
        and c.is_current is true
        and c.classification ~ '^\d+$'
    ),
    '{}'::int[]
  )
from public.rapid_application_raw a
join public.rapid_description_raw d
  on d.application_number = a.application_number
  and d.ip_right_type = 'TM'
  and d.description_type = 'Words'  -- <-- change if section B says otherwise
where a.ip_right_type = 'TM'
  and d.description_value is not null
  and btrim(d.description_value) <> '';

notify pgrst, 'reload schema';

-- Import IPGOD trademark CSVs into staging tables and transform into
-- ipgod_trademarks. Run this in the Supabase SQL editor AFTER schema.sql.
--
-- Source: https://data.gov.au/data/dataset/ipgod2021 (or current IPGOD release)
-- Files: trade-mark-application.csv,
--        trade-mark-application-description.csv,
--        trade-mark-application-classification.csv
--
-- Workflow:
--   1. Run section A to (re)create the staging tables.
--   2. Import each CSV via Supabase Table Editor → table → Import → CSV.
--      Match each file to its table:
--        trade-mark-application.csv               → rapid_application_raw
--        trade-mark-application-description.csv   → rapid_description_raw
--        trade-mark-application-classification.csv→ rapid_classification_raw
--      For files >100MB use psql \copy or the Supabase CLI.
--   3. Run section B to find the description_type that holds the word mark.
--   4. Edit section C to use that value, then run it.

-- ============================================================
-- A. Staging tables matching IPGOD trademark CSV columns.
-- ============================================================

drop table if exists public.rapid_application_raw cascade;
create table public.rapid_application_raw (
  ip_right_type text,
  application_number text,
  ip_right_sub_type text,
  status text,
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
  is_current boolean
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
--    Expected top hit: 'Words' (the actual brand text).
-- ============================================================

-- select description_type, count(*) as n
-- from public.rapid_description_raw
-- group by description_type
-- order by n desc;

-- ============================================================
-- C. Transform: populate ipgod_trademarks.
--    Replace 'Words' below if section B shows a different label.
-- ============================================================

truncate public.ipgod_trademarks restart identity;

insert into public.ipgod_trademarks (tm_number, word, lodgement_date, status, nice_classes)
select
  a.application_number,
  d.description_value,
  a.earliest_filed_date,
  a.status,
  coalesce(
    (
      select array_agg(distinct c.classification::int order by c.classification::int)
      from public.rapid_classification_raw c
      where c.application_number = a.application_number
        and c.classification_system = 'NICE'
        and c.is_current is true
        and c.classification ~ '^\d+$'
    ),
    '{}'::int[]
  )
from public.rapid_application_raw a
join public.rapid_description_raw d
  on d.application_number = a.application_number
  and d.description_type = 'Words'  -- <-- update if section B differs
where d.description_value is not null
  and btrim(d.description_value) <> '';

notify pgrst, 'reload schema';

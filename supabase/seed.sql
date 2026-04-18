-- Seed data for testing the Zombie Brand Scout without loading the full IPGOD dump.
-- Mix of plausibly-vintage Australian trademark names across decades and Nice classes.
-- All rows use a "dead" status value so the scout surfaces them.

insert into public.ipgod_trademarks (tm_number, word, lodgement_date, status, nice_classes) values
  -- 1950s
  ('A100101', 'MARIGOLD',        '1952-03-14', 'LAPSED',    '{25}'),
  ('A100102', 'KINGSWAY',        '1954-07-02', 'REMOVED',   '{18}'),
  ('A100103', 'CORAL REEF',      '1956-11-21', 'CANCELLED', '{3}'),
  ('A100104', 'BLUE MOUNTAIN',   '1958-05-30', 'DEAD',      '{20}'),
  ('A100105', 'ATLAS & SON',     '1953-09-09', 'LAPSED',    '{8}'),

  -- 1960s
  ('A100201', 'BUNYIP',          '1961-02-18', 'CANCELLED', '{18}'),
  ('A100202', 'GOLDLINE',        '1963-06-05', 'LAPSED',    '{14}'),
  ('A100203', 'CIRRUS',          '1965-10-12', 'DEAD',      '{9}'),
  ('A100204', 'SOUTHERN STAR',   '1967-04-29', 'REMOVED',   '{11}'),
  ('A100205', 'HOMEWARD',        '1969-08-15', 'LAPSED',    '{21}'),

  -- 1970s
  ('A100301', 'SILVERGUM',       '1971-01-22', 'CANCELLED', '{20}'),
  ('A100302', 'PARAGON',         '1973-05-17', 'LAPSED',    '{16}'),
  ('A100303', 'VELOCITY',        '1975-09-03', 'DEAD',      '{9}'),
  ('A100304', 'HEIRLOOM',        '1977-11-27', 'REMOVED',   '{14}'),
  ('A100305', 'GROVE & CO',      '1979-03-08', 'LAPSED',    '{25}'),

  -- 1980s
  ('A100401', 'NEON VALLEY',     '1981-06-11', 'CANCELLED', '{9}'),
  ('A100402', 'TERRACE',         '1983-02-24', 'LAPSED',    '{20}'),
  ('A100403', 'HARBOURLIGHT',    '1985-08-30', 'DEAD',      '{11}'),
  ('A100404', 'FIELDMARK',       '1987-10-05', 'REMOVED',   '{18}'),
  ('A100405', 'CITRINE',         '1989-12-19', 'LAPSED',    '{14}'),

  -- 1990s
  ('A100501', 'POLARIS STUDIO',  '1991-04-04', 'CANCELLED', '{16}'),
  ('A100502', 'COASTAL GRAIN',   '1993-07-18', 'LAPSED',    '{21}'),
  ('A100503', 'EDISON & HART',   '1995-09-26', 'DEAD',      '{8}'),
  ('A100504', 'LANTERN',         '1997-01-13', 'REMOVED',   '{11}'),
  ('A100505', 'WAVELENGTH',      '1999-11-02', 'LAPSED',    '{9}');

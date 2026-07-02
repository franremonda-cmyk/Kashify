-- ============================================================
-- M011 — Aprendizaje de Neo: monto típico, tracking de correcciones,
--         y capa GLOBAL compartida entre todos los usuarios.
-- Corré este archivo en Supabase → SQL Editor.
-- ============================================================

-- (1) parser_rules (capa POR USUARIO): monto "de siempre" + tracking de
--     correcciones + updated_at (para el digest semanal).
alter table public.parser_rules add column if not exists last_amount    numeric;
alter table public.parser_rules add column if not exists corrected_count int not null default 0;
alter table public.parser_rules add column if not exists updated_at      timestamptz not null default now();

-- (2) neo_global_rules (capa GLOBAL, compartida entre todos los usuarios).
--     Mapeo keyword → categoría GENÉRICA (por NOMBRE canónico; las 9 categorías
--     default son iguales para todos). SIN montos ni datos personales.
--     Se promueve acá cuando ≥N usuarios distintos enseñan lo mismo (lo hace el
--     service-role desde el cron de promoción). Lo individual (apodos) nunca
--     llega al umbral → nunca se globaliza.
create table if not exists public.neo_global_rules (
  id            uuid primary key default uuid_generate_v4(),
  keyword       text not null,
  category_name text not null,
  type          public.transaction_type not null,
  taught_by     int          not null default 0,   -- usuarios distintos que la enseñaron
  confidence    numeric(5, 2) not null default 60,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  unique (keyword, type)
);

-- Lectura pública (son mapeos genéricos, no personales). La ESCRITURA solo la
-- hace el service-role (cron de promoción); sin policy de insert/update/delete.
alter table public.neo_global_rules enable row level security;
create policy "neo_global_rules readable" on public.neo_global_rules
  for select using (true);

create index if not exists neo_global_rules_keyword on public.neo_global_rules(keyword);

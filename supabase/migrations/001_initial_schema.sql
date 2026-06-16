-- ============================================================
-- NEO — Schema inicial
-- Corré este archivo en Supabase → SQL Editor
-- ============================================================

-- Habilitar extensiones necesarias
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  primary_currency text not null default 'ARS',
  created_at    timestamptz not null default now()
);

-- ============================================================
-- USER_PHONES — números de WhatsApp vinculados
-- ============================================================
create table public.user_phones (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(user_id) on delete cascade,
  phone_number  text not null unique,
  verified      boolean not null default false,
  verify_code   text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- CURRENCIES — catálogo de monedas
-- ============================================================
create table public.currencies (
  code    text primary key,
  name    text not null,
  symbol  text not null
);

insert into public.currencies (code, name, symbol) values
  ('ARS', 'Peso Argentino', '$'),
  ('USD', 'Dólar Estadounidense', 'US$'),
  ('EUR', 'Euro', '€'),
  ('CHF', 'Franco Suizo', 'Fr'),
  ('BRL', 'Real Brasileño', 'R$'),
  ('GBP', 'Libra Esterlina', '£'),
  ('UYU', 'Peso Uruguayo', '$U'),
  ('CLP', 'Peso Chileno', 'CLP$'),
  ('MXN', 'Peso Mexicano', 'MX$'),
  ('COP', 'Peso Colombiano', 'COL$');

-- ============================================================
-- BALANCES — saldo por moneda por usuario
-- ============================================================
create table public.balances (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  currency_code   text not null references public.currencies(code),
  amount          numeric(18, 2) not null default 0,
  updated_at      timestamptz not null default now(),
  unique (user_id, currency_code)
);

-- ============================================================
-- CATEGORIES — categorías de transacciones
-- ============================================================
create table public.categories (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  name        text not null,
  is_default  boolean not null default false,
  color       text not null default '#6366f1',
  icon        text not null default '💰',
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ============================================================
-- CATEGORY_BUDGETS — presupuesto mensual por categoría
-- ============================================================
create table public.category_budgets (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  category_id     uuid not null references public.categories(id) on delete cascade,
  monthly_limit   numeric(18, 2) not null,
  currency_code   text not null references public.currencies(code),
  created_at      timestamptz not null default now(),
  unique (user_id, category_id)
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create type public.transaction_type as enum (
  'expense', 'income', 'conversion', 'installment-payment'
);

create table public.transactions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  type            public.transaction_type not null,
  amount          numeric(18, 2) not null,
  currency_code   text not null references public.currencies(code),
  description     text not null,
  category_id     uuid references public.categories(id),
  card_name       text,
  notes           text,
  date            date not null default current_date,
  -- Para conversiones: moneda y monto de destino
  to_currency_code  text references public.currencies(code),
  to_amount         numeric(18, 2),
  exchange_rate     numeric(18, 6),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- ============================================================
-- INSTALLMENT_PLANS — planes de cuotas
-- ============================================================
create type public.interest_type as enum ('none', 'french');
create type public.plan_status as enum ('active', 'paid');

create table public.installment_plans (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(user_id) on delete cascade,
  name                text not null,
  total_amount        numeric(18, 2) not null,
  currency_code       text not null references public.currencies(code),
  n_installments      int not null check (n_installments > 0),
  installment_amount  numeric(18, 2) not null,
  tna                 numeric(8, 4),
  interest_type       public.interest_type not null default 'none',
  card_name           text,
  category_id         uuid references public.categories(id),
  first_payment_date  date not null,
  status              public.plan_status not null default 'active',
  created_at          timestamptz not null default now()
);

-- ============================================================
-- INSTALLMENT_PAYMENTS — cuotas individuales
-- ============================================================
create type public.payment_status as enum ('pending', 'paid');

create table public.installment_payments (
  id              uuid primary key default uuid_generate_v4(),
  plan_id         uuid not null references public.installment_plans(id) on delete cascade,
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  payment_number  int not null,
  amount          numeric(18, 2) not null,
  due_date        date not null,
  transaction_id  uuid references public.transactions(id),
  status          public.payment_status not null default 'pending',
  unique (plan_id, payment_number)
);

-- ============================================================
-- PARSER_RULES — reglas aprendidas por Neo
-- ============================================================
create table public.parser_rules (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  pattern         text not null,
  type            public.transaction_type not null,
  category_id     uuid references public.categories(id),
  currency_code   text references public.currencies(code),
  confidence      numeric(5, 2) not null default 0 check (confidence between 0 and 100),
  match_count     int not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- WEBHOOK_EVENTS — cola de mensajes de WhatsApp
-- ============================================================
create type public.webhook_status as enum ('pending', 'processing', 'done', 'failed');

create table public.webhook_events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(user_id) on delete set null,
  raw_payload jsonb not null,
  status      public.webhook_status not null default 'pending',
  error       text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PENDING_TRANSACTIONS — mensajes que Neo no pudo resolver
-- ============================================================
create type public.pending_status as enum ('waiting', 'confirmed', 'dismissed');

create table public.pending_transactions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(user_id) on delete cascade,
  raw_text            text not null,
  neo_interpretation  jsonb,
  status              public.pending_status not null default 'waiting',
  expires_at          timestamptz not null default (now() + interval '24 hours'),
  created_at          timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATION_LOG — para deduplicar alertas
-- ============================================================
create table public.notification_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  alert_type  text not null,
  ref_id      text,
  sent_at     timestamptz not null default now(),
  unique (user_id, alert_type, ref_id)
);

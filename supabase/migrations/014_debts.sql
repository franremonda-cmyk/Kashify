-- ============================================================
-- M014 — DEUDAS (préstamos informales, plata suelta debida/por cobrar)
-- Corré este archivo en Supabase → SQL Editor.
--
-- Separado de installment_plans ("Cuotas" = compras financiadas con
-- tarjeta): acá no hay cronograma fijo ni tarjeta, y puede ir en
-- cualquier dirección (debo / me deben). Reusa plan_status
-- (active/paid) en vez de un enum nuevo.
-- ============================================================

create type public.debt_direction as enum ('debo', 'me_deben');

create table public.debts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(user_id) on delete cascade,
  space_id      uuid references public.spaces(id) on delete cascade,
  direction     public.debt_direction not null,
  counterparty  text not null,
  description   text,
  total_amount  numeric(18, 2) not null check (total_amount > 0),
  paid_amount   numeric(18, 2) not null default 0,
  currency_code text not null references public.currencies(code),
  due_date      date,
  status        public.plan_status not null default 'active',
  created_at    timestamptz not null default now()
);

create index debts_user on public.debts(user_id);

alter table public.debts enable row level security;
create policy "Users own their debts"
  on public.debts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

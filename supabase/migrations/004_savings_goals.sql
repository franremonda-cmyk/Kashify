-- ============================================================
-- SAVINGS_GOALS — metas / planes de ahorro
-- Corré este archivo en Supabase → SQL Editor
-- ============================================================

create table public.savings_goals (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  name            text not null,
  target_amount   numeric(18, 2) not null check (target_amount > 0),
  current_amount  numeric(18, 2) not null default 0 check (current_amount >= 0),
  currency_code   text not null references public.currencies(code),
  target_date     date,
  color           text not null default '#7B61FF',
  icon            text not null default 'piggy-bank',
  status          text not null default 'active' check (status in ('active', 'reached', 'archived')),
  created_at      timestamptz not null default now()
);

-- Row Level Security
alter table public.savings_goals enable row level security;
create policy "Users own their savings goals"
  on public.savings_goals for all
  using (auth.uid() = user_id);

-- ============================================================
-- ROW LEVEL SECURITY — todas las tablas de usuario
-- ============================================================

-- profiles
alter table public.profiles enable row level security;
create policy "Users own their profile"
  on public.profiles for all
  using (auth.uid() = user_id);

-- user_phones
alter table public.user_phones enable row level security;
create policy "Users own their phones"
  on public.user_phones for all
  using (auth.uid() = user_id);

-- currencies — lectura pública (es catálogo)
alter table public.currencies enable row level security;
create policy "Anyone can read currencies"
  on public.currencies for select
  using (true);

-- balances
alter table public.balances enable row level security;
create policy "Users own their balances"
  on public.balances for all
  using (auth.uid() = user_id);

-- categories
alter table public.categories enable row level security;
create policy "Users own their categories"
  on public.categories for all
  using (auth.uid() = user_id);

-- category_budgets
alter table public.category_budgets enable row level security;
create policy "Users own their budgets"
  on public.category_budgets for all
  using (auth.uid() = user_id);

-- transactions
alter table public.transactions enable row level security;
create policy "Users own their transactions"
  on public.transactions for all
  using (auth.uid() = user_id);

-- installment_plans
alter table public.installment_plans enable row level security;
create policy "Users own their installment plans"
  on public.installment_plans for all
  using (auth.uid() = user_id);

-- installment_payments
alter table public.installment_payments enable row level security;
create policy "Users own their installment payments"
  on public.installment_payments for all
  using (auth.uid() = user_id);

-- parser_rules
alter table public.parser_rules enable row level security;
create policy "Users own their parser rules"
  on public.parser_rules for all
  using (auth.uid() = user_id);

-- webhook_events — solo service role puede escribir; usuario solo lee los suyos
alter table public.webhook_events enable row level security;
create policy "Users can read their webhook events"
  on public.webhook_events for select
  using (auth.uid() = user_id);

-- pending_transactions
alter table public.pending_transactions enable row level security;
create policy "Users own their pending transactions"
  on public.pending_transactions for all
  using (auth.uid() = user_id);

-- notification_log
alter table public.notification_log enable row level security;
create policy "Users can read their notification log"
  on public.notification_log for select
  using (auth.uid() = user_id);

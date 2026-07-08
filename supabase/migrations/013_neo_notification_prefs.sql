-- ============================================================
-- NEO_NOTIFICATION_PREFS — silenciar familias de aviso + back-off automático
-- El cron neo-insights no emite (ni el feed muestra) familias con
-- muted_until en el futuro. Silenciar explícito = fecha lejana; back-off
-- automático (ignorás varios) = pausa de semanas que se auto-expira.
-- Corré este archivo en Supabase → SQL Editor.
-- ============================================================

create table if not exists public.neo_notification_prefs (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  family        text        not null,
  muted_until   timestamptz,           -- en el futuro = silenciado; null = activo
  dismiss_count int         not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, family)
);

alter table public.neo_notification_prefs enable row level security;

create policy "neo_notification_prefs_own"
  on public.neo_notification_prefs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

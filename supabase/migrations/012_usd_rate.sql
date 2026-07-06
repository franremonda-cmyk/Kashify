-- ============================================================
-- USD_RATE — tipo de cambio manual del usuario (1 USD = X moneda principal)
-- Permite que la vista Total multi-divisa cierre en una sola moneda.
-- Corré este archivo en Supabase → SQL Editor
-- ============================================================

alter table public.profiles
  add column if not exists usd_rate numeric(18, 2) check (usd_rate is null or usd_rate > 0);

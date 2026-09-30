-- ============================================================
-- M017 — BORRAR UNA DEUDA YA NO ELIMINA SUS MOVIMIENTOS
-- Corré en Supabase → SQL Editor. Se puede correr dos veces.
--
-- Con la 015, borrar una deuda eliminaba de verdad (cascade) el préstamo y
-- sus pagos: irrecuperables. Ahora la app los marca borrados (deleted_at,
-- igual que un gasto borrado) y la FK queda en "set null": salen del neto
-- pero siguen en la base por si hay que recuperarlos.
-- ============================================================

alter table public.transactions drop constraint if exists transactions_debt_id_fkey;
alter table public.transactions
  add constraint transactions_debt_id_fkey
  foreign key (debt_id) references public.debts(id) on delete set null;

-- ============================================================
-- M015 — ZONA HORARIA POR USUARIO + MOVIMIENTOS ENLAZADOS A SU DEUDA
-- Corré este archivo en Supabase → SQL Editor. Se puede correr dos veces.
--
-- 1) profiles.timezone: el servidor corre en UTC y WhatsApp no trae zona,
--    así que Neo fechaba "mañana" todo lo cargado después de las 21 (AR).
--    La web la sincroniza sola con la zona del celular.
-- 2) transactions.debt_id: el egreso de un "me deben" y los pagos/cobros
--    quedan atados a su deuda. Borrar la deuda borra sus movimientos (el neto
--    queda como si no hubiera existido) y editar el monto ajusta el egreso.
--    Los movimientos de deudas viejas (antes de esta migración) no se enlazan.
--
-- El código funciona sin esta migración (degrada al comportamiento anterior).
-- ============================================================

alter table public.profiles
  add column if not exists timezone text not null default 'America/Argentina/Buenos_Aires';

alter table public.transactions
  add column if not exists debt_id uuid references public.debts(id) on delete cascade;

create index if not exists transactions_debt_id
  on public.transactions(debt_id) where debt_id is not null;

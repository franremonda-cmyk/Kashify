-- ============================================================
-- M016 — ENLAZAR LOS MOVIMIENTOS DE LAS DEUDAS VIEJAS (antes de la 015)
-- Requiere la 015 ya corrida (columna transactions.debt_id).
--
-- Corré en Supabase → SQL Editor, UN PASO POR VEZ (seleccioná el bloque y
-- "Run selected"):
--   PASO 1  mirar: qué se va a enlazar. NO cambia nada.
--   PASO 2  enlazar: solo los casos sin ambigüedad. Se puede repetir.
--   PASO 3  mirar: lo que quedó sin enlazar, con candidatos para decidir a mano.
--   DESHACER al final, por si hace falta.
--
-- Cómo reconoce los movimientos (los generaban siempre igual Neo y la web):
--   • egreso de origen de un "me deben": gasto del mismo usuario, mismo monto y
--     moneda, creado ±10 min de la deuda o con la descripción "Préstamo a <persona>".
--   • pagos / cobros: descripción exacta "<persona> — pago de deuda" o
--     "<persona> — cobro de deuda", misma moneda, posteriores a la deuda.
-- Si un movimiento le sirve a dos deudas (ej. dos deudas con la misma persona
-- y moneda) o una deuda tiene dos egresos candidatos, NO se toca: va al paso 3.
-- ============================================================


-- ─── PASO 1 — MIRAR (no cambia nada) ────────────────────────────────────────
with
origen as (
  select d.id as debt_id, t.id as tx_id, 'origen'::text as tipo
  from public.debts d
  join public.transactions t
    on t.user_id = d.user_id and t.debt_id is null and t.deleted_at is null
   and t.type::text = 'expense'
   and t.amount = d.total_amount and t.currency_code = d.currency_code
   and (abs(extract(epoch from (t.created_at - d.created_at))) < 600
        or t.description ilike 'Préstamo a ' || d.counterparty || '%')
  where d.direction::text = 'me_deben'
),
pagos as (
  select d.id as debt_id, t.id as tx_id, 'pago/cobro'::text as tipo
  from public.debts d
  join public.transactions t
    on t.user_id = d.user_id and t.debt_id is null and t.deleted_at is null
   and t.currency_code = d.currency_code
   and t.created_at >= d.created_at - interval '1 minute'
   and t.description = d.counterparty || case when d.direction::text = 'debo' then ' — pago de deuda' else ' — cobro de deuda' end
   and t.type::text = case when d.direction::text = 'debo' then 'expense' else 'income' end
),
cand as (select * from origen union all select * from pagos),
evaluado as (
  select c.*,
    (select count(*) from cand x where x.tx_id = c.tx_id) = 1
    and (c.tipo <> 'origen' or (select count(*) from cand y where y.debt_id = c.debt_id and y.tipo = 'origen') = 1)
    as seguro
  from cand c
)
select
  case when e.seguro then '✓ se enlaza' else '✗ ambiguo (paso 3)' end as resultado,
  d.counterparty as persona, d.direction as direccion,
  d.currency_code || ' ' || d.total_amount as deuda,
  e.tipo, t.date as fecha, t.description as movimiento, t.amount as monto
from evaluado e
join public.debts d on d.id = e.debt_id
join public.transactions t on t.id = e.tx_id
order by d.counterparty, d.created_at, e.tipo, t.date;


-- ─── PASO 2 — ENLAZAR (solo los "✓ se enlaza" del paso 1) ───────────────────
with
origen as (
  select d.id as debt_id, t.id as tx_id, 'origen'::text as tipo
  from public.debts d
  join public.transactions t
    on t.user_id = d.user_id and t.debt_id is null and t.deleted_at is null
   and t.type::text = 'expense'
   and t.amount = d.total_amount and t.currency_code = d.currency_code
   and (abs(extract(epoch from (t.created_at - d.created_at))) < 600
        or t.description ilike 'Préstamo a ' || d.counterparty || '%')
  where d.direction::text = 'me_deben'
),
pagos as (
  select d.id as debt_id, t.id as tx_id, 'pago/cobro'::text as tipo
  from public.debts d
  join public.transactions t
    on t.user_id = d.user_id and t.debt_id is null and t.deleted_at is null
   and t.currency_code = d.currency_code
   and t.created_at >= d.created_at - interval '1 minute'
   and t.description = d.counterparty || case when d.direction::text = 'debo' then ' — pago de deuda' else ' — cobro de deuda' end
   and t.type::text = case when d.direction::text = 'debo' then 'expense' else 'income' end
),
cand as (select * from origen union all select * from pagos),
seguros as (
  select c.* from cand c
  where (select count(*) from cand x where x.tx_id = c.tx_id) = 1
    and (c.tipo <> 'origen' or (select count(*) from cand y where y.debt_id = c.debt_id and y.tipo = 'origen') = 1)
)
update public.transactions t
set debt_id = s.debt_id
from seguros s
where t.id = s.tx_id and t.debt_id is null
returning t.id, t.description, t.amount, t.currency_code, s.tipo;


-- ─── PASO 3 — MIRAR LO QUE QUEDÓ (deudas a revisar a mano) ──────────────────
-- Deudas cuyo dinero no cierra con lo enlazado. "falta" = lo que debería haber
-- enlazado y no está. Debajo de cada una, gastos/ingresos en "Deudas" o de la
-- misma persona que podrían ser el suyo.
select
  d.id as deuda_id, d.counterparty as persona, d.direction as direccion,
  d.currency_code || ' ' || d.total_amount as deuda, d.paid_amount as pagado,
  coalesce(sum(t.amount) filter (where t.type::text = 'expense' and d.direction::text = 'me_deben'), 0) as origen_enlazado,
  coalesce(sum(t.amount) filter (where t.description like '% — %de deuda'), 0) as pagos_enlazados,
  concat_ws(' · ',
    case when d.direction::text = 'me_deben'
          and coalesce(sum(t.amount) filter (where t.type::text = 'expense'), 0) <> d.total_amount
         then 'falta el egreso del préstamo' end,
    case when coalesce(sum(t.amount) filter (where t.description like '% — %de deuda'), 0) <> d.paid_amount
         then 'faltan pagos/cobros' end
  ) as falta
from public.debts d
left join public.transactions t on t.debt_id = d.id and t.deleted_at is null
group by d.id
having (d.direction::text = 'me_deben'
        and coalesce(sum(t.amount) filter (where t.type::text = 'expense'), 0) <> d.total_amount)
    or coalesce(sum(t.amount) filter (where t.description like '% — %de deuda'), 0) <> d.paid_amount
order by d.counterparty;

-- Candidatos para una deuda puntual (reemplazá el id por uno del listado de arriba):
-- select t.id, t.date, t.type, t.description, t.amount, t.currency_code
-- from public.transactions t join public.debts d on d.id = '<deuda_id>'
-- where t.user_id = d.user_id and t.debt_id is null and t.deleted_at is null
--   and t.currency_code = d.currency_code
--   and (t.description ilike '%' || d.counterparty || '%' or t.amount = d.total_amount)
-- order by t.date;
--
-- Enlazar uno a mano:
-- update public.transactions set debt_id = '<deuda_id>' where id = '<movimiento_id>';
--
-- "falta el egreso del préstamo" en un "me deben" cargado POR LA WEB antes del
-- arreglo del 30/09: ese egreso nunca existió (era el bug: al cobrarla, el neto
-- subía de más). Si esa plata realmente salió de tu bolsillo, crealo con la
-- fecha de la deuda (baja el neto en ese monto):
-- insert into public.transactions (user_id, space_id, type, amount, currency_code, description, date, category_id, debt_id)
-- select d.user_id, d.space_id, 'expense', d.total_amount, d.currency_code,
--        'Préstamo a ' || d.counterparty,
--        (d.created_at at time zone 'America/Argentina/Buenos_Aires')::date,
--        (select c.id from public.categories c where c.user_id = d.user_id and c.name = 'Deudas' limit 1),
--        d.id
-- from public.debts d where d.id = '<deuda_id>';


-- ─── DESHACER (solo si hace falta) ──────────────────────────────────────────
-- Quita TODOS los enlaces de deudas creadas antes de la 015 (los nuevos no se tocan):
-- update public.transactions t set debt_id = null
-- from public.debts d
-- where t.debt_id = d.id and d.created_at < '<fecha y hora en que corriste la 015>';

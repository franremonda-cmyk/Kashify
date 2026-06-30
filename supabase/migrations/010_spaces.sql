-- ============================================================
-- M010 — ESPACIOS (multi-cuenta dentro de un mismo perfil)
-- Corré este archivo en Supabase → SQL Editor.
--
-- Un "espacio" agrupa movimientos/presupuestos/metas. El balance se
-- computa por espacio desde transactions (no se toca la tabla balances
-- ni su trigger: el dashboard ahora suma por space_id).
-- "Total Personal" = suma de los espacios con include_in_total = true.
-- ============================================================

-- ---------- Tabla spaces ----------
create table public.spaces (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references public.profiles(user_id) on delete cascade,
  name             text not null,
  primary_currency text not null default 'ARS' references public.currencies(code),
  include_in_total boolean not null default true,
  is_default       boolean not null default false,
  color            text not null default '#46B58C',
  icon             text not null default '💼',
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

-- Un solo espacio por defecto por usuario
create unique index spaces_one_default on public.spaces(user_id) where is_default;
create index spaces_user on public.spaces(user_id);

alter table public.spaces enable row level security;
create policy "Users own their spaces" on public.spaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- space_id en las tablas que se separan por espacio ----------
-- (categories y parser_rules quedan globales = compartidas entre espacios)
alter table public.transactions      add column space_id uuid references public.spaces(id) on delete cascade;
alter table public.category_budgets  add column space_id uuid references public.spaces(id) on delete cascade;
alter table public.savings_goals     add column space_id uuid references public.spaces(id) on delete cascade;
alter table public.installment_plans add column space_id uuid references public.spaces(id) on delete cascade;

-- ---------- Backfill: un espacio "Personal" por perfil existente ----------
insert into public.spaces (user_id, name, primary_currency, include_in_total, is_default)
select user_id, 'Personal', primary_currency, true, true
from public.profiles;

-- Mover todo lo existente al espacio Personal de su dueño
update public.transactions t
  set space_id = s.id from public.spaces s
  where s.user_id = t.user_id and s.is_default;
update public.category_budgets b
  set space_id = s.id from public.spaces s
  where s.user_id = b.user_id and s.is_default;
update public.savings_goals g
  set space_id = s.id from public.spaces s
  where s.user_id = g.user_id and s.is_default;
update public.installment_plans p
  set space_id = s.id from public.spaces s
  where s.user_id = p.user_id and s.is_default;

-- ---------- space_id queda NULLABLE a propósito (expand/contract) ----------
-- Así esta migración es segura de correr ANTES de deployar el código nuevo: el
-- código viejo inserta sin space_id (queda null) y no rompe; el código nuevo
-- siempre lo setea. Después del deploy se puede apretar a NOT NULL con una
-- migración 011 (cuando ya no queda código viejo escribiendo).
create index transactions_space on public.transactions(space_id);

-- El mismo presupuesto (categoría) puede existir en distintos espacios
alter table public.category_budgets drop constraint category_budgets_user_id_category_id_key;
alter table public.category_budgets add  constraint category_budgets_user_space_category_key
  unique (user_id, space_id, category_id);

-- ---------- Default-space para usuarios nuevos ----------
-- Extiende handle_new_user (003) para crear también el espacio Personal.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, display_name, primary_currency)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'ARS'
  );

  insert into public.categories (user_id, name, is_default, color, icon) values
    (new.id, 'Comida',      true, '#f97316', '🍔'),
    (new.id, 'Transporte',  true, '#3b82f6', '🚗'),
    (new.id, 'Servicios',   true, '#8b5cf6', '💡'),
    (new.id, 'Ocio',        true, '#ec4899', '🎮'),
    (new.id, 'Salud',       true, '#10b981', '❤️'),
    (new.id, 'Ahorro',      true, '#eab308', '🏦'),
    (new.id, 'Deudas',      true, '#ef4444', '💳'),
    (new.id, 'Ingresos',    true, '#22c55e', '💰'),
    (new.id, 'Otros',       true, '#6b7280', '📦');

  insert into public.spaces (user_id, name, primary_currency, include_in_total, is_default)
  values (new.id, 'Personal', 'ARS', true, true);

  return new;
end;
$$;

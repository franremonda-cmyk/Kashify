-- ============================================================
-- TRIGGER: crear perfil y categorías default al registrarse
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- Crear perfil
  insert into public.profiles (user_id, display_name, primary_currency)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'ARS'
  );

  -- Crear categorías default
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- FUNCIÓN: actualizar balance al insertar/eliminar transacción
-- ============================================================

create or replace function public.update_balance_on_transaction()
returns trigger language plpgsql security definer as $$
declare
  v_delta numeric;
begin
  if TG_OP = 'INSERT' and NEW.deleted_at is null then
    -- Determinar delta según tipo
    if NEW.type in ('expense', 'installment-payment') then
      v_delta := -NEW.amount;
    elsif NEW.type = 'income' then
      v_delta := NEW.amount;
    elsif NEW.type = 'conversion' then
      -- Resta de moneda origen
      insert into public.balances (user_id, currency_code, amount)
      values (NEW.user_id, NEW.currency_code, -NEW.amount)
      on conflict (user_id, currency_code)
      do update set amount = public.balances.amount - NEW.amount, updated_at = now();
      -- Suma a moneda destino
      insert into public.balances (user_id, currency_code, amount)
      values (NEW.user_id, NEW.to_currency_code, NEW.to_amount)
      on conflict (user_id, currency_code)
      do update set amount = public.balances.amount + NEW.to_amount, updated_at = now();
      return NEW;
    end if;

    insert into public.balances (user_id, currency_code, amount)
    values (NEW.user_id, NEW.currency_code, v_delta)
    on conflict (user_id, currency_code)
    do update set amount = public.balances.amount + v_delta, updated_at = now();

  elsif TG_OP = 'UPDATE' and OLD.deleted_at is null and NEW.deleted_at is not null then
    -- Soft delete: revertir el efecto de la transacción
    if OLD.type in ('expense', 'installment-payment') then
      v_delta := OLD.amount;
    elsif OLD.type = 'income' then
      v_delta := -OLD.amount;
    elsif OLD.type = 'conversion' then
      update public.balances set amount = amount + OLD.amount, updated_at = now()
        where user_id = OLD.user_id and currency_code = OLD.currency_code;
      update public.balances set amount = amount - OLD.to_amount, updated_at = now()
        where user_id = OLD.user_id and currency_code = OLD.to_currency_code;
      return NEW;
    end if;

    update public.balances
    set amount = amount + v_delta, updated_at = now()
    where user_id = OLD.user_id and currency_code = OLD.currency_code;
  end if;

  return NEW;
end;
$$;

create trigger trg_update_balance
  after insert or update on public.transactions
  for each row execute procedure public.update_balance_on_transaction();

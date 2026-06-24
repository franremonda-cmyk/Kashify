-- ============================================================
-- PENDING_CONTACTS — números que le escribieron a Neo por WhatsApp
-- SIN estar registrados todavía. Se recuerdan para poder vincularlos
-- cuando creen su cuenta desde la web.
-- Solo el service-role (worker) lo usa; RLS activo sin policy de usuario.
-- ============================================================
create table public.pending_contacts (
  phone_number    text primary key,
  first_message   text,
  last_contact_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

alter table public.pending_contacts enable row level security;
-- Sin policy: ningún usuario lo lee/escribe; el worker usa service-role (bypassa RLS).

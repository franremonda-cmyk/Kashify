-- ============================================================
-- NEO_CONVERSATION_STATE — estado de conversación multi-turno
-- Necesario para WhatsApp (sin cliente que recuerde el contexto).
-- La web sigue haciendo round-trip del estado por el cliente.
-- ============================================================
create table public.neo_conversation_state (
  user_id     uuid primary key references public.profiles(user_id) on delete cascade,
  state       jsonb not null,
  expires_at  timestamptz not null default (now() + interval '15 minutes'),
  updated_at  timestamptz not null default now()
);

-- RLS: el usuario es dueño de su propio estado. El service-role (worker de
-- WhatsApp) bypassa RLS, así que no necesita policy adicional.
alter table public.neo_conversation_state enable row level security;
create policy "Users own their neo conversation state"
  on public.neo_conversation_state for all
  using (auth.uid() = user_id);

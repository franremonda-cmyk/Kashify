-- Preferencias de apariencia por usuario, para que persistan entre dispositivos
-- y sobrevivan la evicción de localStorage (Safari/PWA borra localStorage tras
-- ~7 días sin uso). La app sigue usando localStorage como caché rápido, pero la
-- DB es la fuente de verdad: al entrar restaura la preferencia guardada.
alter table public.profiles
  add column if not exists theme      text not null default 'arctic',
  add column if not exists icon_style text not null default 'emoji';

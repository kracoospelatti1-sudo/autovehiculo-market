-- Configuracion centralizada para integracion con Instagram
-- Ejecutar una vez en Supabase SQL Editor

create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by integer null references public.users(id) on delete set null
);

alter table public.app_settings enable row level security;

-- Bloquear acceso directo desde clientes anon/authenticated.
revoke all on table public.app_settings from anon, authenticated;
grant select, insert, update, delete on table public.app_settings to service_role;

insert into public.app_settings (key, value)
values
  ('instagram_graph_api_version', 'v25.0'),
  ('instagram_default_hashtags', '#autoventa #autosusados #autos #argentina')
on conflict (key) do nothing;

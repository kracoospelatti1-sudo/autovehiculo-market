-- Registro de publicaciones de Instagram asociadas a cada vehiculo.
-- Ejecutar una vez en Supabase SQL Editor.

create table if not exists public.vehicle_instagram_posts (
  id bigserial primary key,
  vehicle_id integer not null references public.vehicles(id) on delete cascade,
  media_id text not null unique,
  permalink text not null default '',
  published_by integer null references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicle_instagram_posts_vehicle_id
  on public.vehicle_instagram_posts(vehicle_id);

alter table public.vehicle_instagram_posts enable row level security;

revoke all on table public.vehicle_instagram_posts from anon, authenticated;
grant select, insert, update, delete on table public.vehicle_instagram_posts to service_role;

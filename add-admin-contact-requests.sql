-- Consultas al equipo administrador
-- Ejecutar una vez en Supabase SQL Editor

create table if not exists public.admin_contact_requests (
  id bigserial primary key,
  requester_user_id integer references public.users(id) on delete set null,
  reason text not null,
  contact text not null,
  message text,
  status text not null default 'pending',
  admin_note text,
  handled_by integer references public.users(id) on delete set null,
  handled_at timestamptz,
  requester_ip text,
  requester_user_agent text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_contact_requests_status_check'
      and conrelid = 'public.admin_contact_requests'::regclass
  ) then
    alter table public.admin_contact_requests
      add constraint admin_contact_requests_status_check
      check (status in ('pending', 'reviewed', 'resolved', 'dismissed'));
  end if;
end $$;

create index if not exists admin_contact_requests_status_idx
  on public.admin_contact_requests (status);

create index if not exists admin_contact_requests_created_at_idx
  on public.admin_contact_requests (created_at desc);

create index if not exists admin_contact_requests_requester_user_id_idx
  on public.admin_contact_requests (requester_user_id);

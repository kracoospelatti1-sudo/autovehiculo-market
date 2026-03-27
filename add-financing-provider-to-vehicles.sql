-- Fuente de financiación por publicación
-- Ejecutar una vez en Supabase SQL Editor

alter table public.vehicles
  add column if not exists financing_provider text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicles_financing_provider_check'
      and conrelid = 'public.vehicles'::regclass
  ) then
    alter table public.vehicles
      add constraint vehicles_financing_provider_check
      check (
        financing_provider is null
        or financing_provider in ('prestito', 'propia')
      );
  end if;
end $$;

alter table public.vehicles
  alter column financing_provider set default 'prestito';

update public.vehicles
set financing_provider = 'prestito'
where accepts_financing = true
  and (financing_provider is null or financing_provider = '');

update public.vehicles
set financing_provider = null
where coalesce(accepts_financing, false) = false;

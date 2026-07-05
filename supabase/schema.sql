-- Chutemundo v1.2 - esquema base para respaldo en Supabase
-- Ejecutar en Supabase SQL Editor.
-- Este esquema guarda el estado completo de la app como JSONB.
-- Más adelante se puede normalizar a tablas de torneos, partidos, equipos y eventos.

create table if not exists public.chutemundo_app_states (
  id text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.chutemundo_app_states enable row level security;

-- Opción recomendada para producción futura: usar Supabase Auth.
-- Cuando la app tenga inicio de sesión, agrega owner_id y políticas por usuario.
-- Por ahora NO se incluye una política pública de escritura, para evitar que cualquiera
-- pueda modificar datos si publicas la app con el proyecto Supabase expuesto.

-- Para pruebas privadas rápidas, puedes crear temporalmente una política manual desde Supabase,
-- pero no la dejes activa si la URL pública de la app será compartida.

create index if not exists chutemundo_app_states_updated_at_idx
on public.chutemundo_app_states (updated_at desc);

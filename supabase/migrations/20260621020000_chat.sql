-- Chat de equipo por proyecto, en tiempo real.
-- Mensajes planos (sin hilos) ligados a un proyecto y a su autor (persona).
-- Realtime: el cliente se suscribe a los INSERT filtrando por proyecto_id.

create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos (id) on delete cascade,
  autor_id uuid not null references personas (id) on delete cascade,
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mensajes_proyecto on mensajes (proyecto_id, created_at);

-- ── RLS permisivo (mismo patrón que el resto: authenticated lee/escribe todo) ──
alter table mensajes enable row level security;

-- Grant de tabla (las tablas creadas después del init no heredan el grant base).
grant select, insert, update, delete on mensajes to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mensajes'
      and policyname = 'auth_all_mensajes'
  ) then
    create policy auth_all_mensajes on mensajes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Solo INSERT desde el cliente; el payload de INSERT siempre trae la fila nueva
-- completa, así que no hace falta replica identity full.
alter publication supabase_realtime add table mensajes;

-- Compuerta EXTERNA con el cliente.
-- Una reunión de tipo 'cliente' cuya extracción IA produce CORRECCIONES (feedback del cliente).
-- Al confirmarlas se crean con tipo='correccion' ligadas a su módulo; si una corrección
-- toca un módulo ya 'cerrado', el módulo se REABRE (→abierto). Un cliente por proyecto.

-- ── Nuevo valor de enum tipo_reunion ─────────────────────────────────────────
-- `alter type ... add value` no puede correr dentro de un bloque transaccional
-- junto a otras sentencias en algunos contextos; va suelto y primero.
alter type tipo_reunion add value if not exists 'cliente';

-- ── Cliente por proyecto (uno por proyecto) ──────────────────────────────────
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text,
  proyecto_id uuid not null unique references proyectos (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_clientes_proyecto on clientes (proyecto_id);

-- ── RLS permisivo (mismo patrón que el resto: authenticated lee/escribe todo) ──
alter table clientes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clientes'
      and policyname = 'auth_all_clientes'
  ) then
    create policy auth_all_clientes on clientes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Compuerta interna de revisión de módulos.
-- Cuando un módulo pasa a 'en_revision', el responsable de visión del proyecto
-- lo revisa contra la Definición y decide Aprobar (→cerrado) o Devolver (→abierto).
-- Reemplaza el cierre manual de módulos.

-- ── Responsable de visión por proyecto ───────────────────────────────────────
alter table proyectos
  add column if not exists responsable_vision_id uuid references personas (id) on delete set null;

-- ── Comentarios sobre módulos (feedback de revisión) ──────────────────────────
-- Hasta ahora un comentario era siempre de una tarea. Ahora puede ser de un módulo.
alter table comentarios
  add column if not exists modulo_id uuid references modulos (id) on delete cascade;

alter table comentarios
  alter column tarea_id drop not null;

-- Exactamente uno de (tarea_id, modulo_id) no nulo. Idempotente: solo si falta.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'comentarios_target_chk'
  ) then
    alter table comentarios
      add constraint comentarios_target_chk
      check ((tarea_id is not null) <> (modulo_id is not null));
  end if;
end $$;

create index if not exists idx_comentarios_modulo on comentarios (modulo_id);

-- ── Historial de revisiones de módulo ─────────────────────────────────────────
create table if not exists modulo_revisiones (
  id         uuid primary key default gen_random_uuid(),
  modulo_id  uuid not null references modulos (id) on delete cascade,
  revisor_id uuid references personas (id) on delete set null,
  resultado  text not null check (resultado in ('aprobado', 'devuelto')),
  created_at timestamptz not null default now()
);

create index if not exists idx_modulo_revisiones_modulo on modulo_revisiones (modulo_id);

-- ── RLS permisivo (mismo patrón que el resto: authenticated lee/escribe todo) ──
alter table modulo_revisiones enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'modulo_revisiones'
      and policyname = 'auth_all_modulo_revisiones'
  ) then
    create policy auth_all_modulo_revisiones on modulo_revisiones
      for all to authenticated using (true) with check (true);
  end if;
end $$;

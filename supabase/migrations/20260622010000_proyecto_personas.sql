-- Membresía explícita de proyecto. Antes los "miembros" se infieren de quién
-- tiene tareas asignadas; con esto se curan a mano (sumar/quitar sin asignar tarea).
-- Base para permisos por-proyecto y vista de carga.
create table if not exists public.proyecto_personas (
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  persona_id  uuid not null references public.personas (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (proyecto_id, persona_id)
);

alter table public.proyecto_personas enable row level security;

-- Mismo modelo equipo-único que el resto: cualquier miembro gestiona membresías.
create policy miembro_select_proyecto_personas on public.proyecto_personas
  for select to authenticated using (public.es_miembro());
create policy miembro_insert_proyecto_personas on public.proyecto_personas
  for insert to authenticated with check (public.es_miembro());
create policy miembro_delete_proyecto_personas on public.proyecto_personas
  for delete to authenticated using (public.es_miembro());

-- Backfill: quien ya tiene tareas asignadas queda como miembro de ese proyecto,
-- así nada queda vacío tras el deploy.
insert into public.proyecto_personas (proyecto_id, persona_id)
select distinct mo.proyecto_id, t.responsable_id
from public.tareas t
join public.modulos mo on mo.id = t.modulo_id
where t.responsable_id is not null
on conflict do nothing;

-- Funcionalidad para un equipo de socios con varios proyectos hechos con IA:
--   · prioridad de tarea (foco entre proyectos)
--   · repo por proyecto y PR por tarea (webhook de GitHub → /api/github)
--   · registro de decisiones (extraídas de reuniones o cargadas a mano)
--   · vista de salud de la cartera (v_salud_proyectos)
--   · permisos por proyecto: el responsable de visión aprueba/borra, no solo el rol PO global

-- ── Prioridad ────────────────────────────────────────────────────────────────
do $$
begin
  create type prioridad_tarea as enum ('alta', 'media', 'baja');
exception
  when duplicate_object then null;
end $$;

alter table tareas
  add column if not exists prioridad prioridad_tarea not null default 'media';

-- ── GitHub ───────────────────────────────────────────────────────────────────
alter table proyectos add column if not exists repo_url text;
alter table tareas    add column if not exists pr_url   text;
create index if not exists idx_tareas_pr_url on tareas (pr_url) where pr_url is not null;

-- ── Decisiones ───────────────────────────────────────────────────────────────
create table if not exists decisiones (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos (id) on delete cascade,
  reunion_id  uuid references reuniones (id) on delete set null,
  autor_id    uuid references personas (id) on delete set null,
  texto       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_decisiones_proyecto on decisiones (proyecto_id, created_at desc);

alter table decisiones enable row level security;
grant select, insert, update, delete on decisiones to authenticated;

drop policy if exists miembro_select_decisiones on decisiones;
drop policy if exists miembro_insert_decisiones on decisiones;
drop policy if exists miembro_update_decisiones on decisiones;
drop policy if exists miembro_delete_decisiones on decisiones;
create policy miembro_select_decisiones on decisiones
  for select to authenticated using (public.es_miembro());
create policy miembro_insert_decisiones on decisiones
  for insert to authenticated with check (public.es_miembro());
create policy miembro_update_decisiones on decisiones
  for update to authenticated using (public.es_miembro()) with check (public.es_miembro());
create policy miembro_delete_decisiones on decisiones
  for delete to authenticated using (public.es_miembro());

-- ── Permisos por proyecto ────────────────────────────────────────────────────
-- Puede aprobar/borrar en un proyecto: su responsable de visión, cualquier PO,
-- o cualquiera si el proyecto todavía no tiene responsable de visión.
create or replace function public.puede_aprobar(p_proyecto uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_po()
      or exists (
        select 1 from proyectos p
        where p.id = p_proyecto
          and (p.responsable_vision_id is null
               or p.responsable_vision_id = public.persona_actual_id())
      );
$$;
grant execute on function public.puede_aprobar(uuid) to authenticated;

drop policy if exists po_delete_proyectos on proyectos;
drop policy if exists responsable_delete_proyectos on proyectos;
create policy responsable_delete_proyectos on proyectos
  for delete to authenticated
  using (public.es_po() or responsable_vision_id = public.persona_actual_id());

-- Historial de revisión de módulo: solo quien puede aprobar en ese proyecto.
drop policy if exists miembro_insert_modulo_revisiones on modulo_revisiones;
drop policy if exists aprobador_insert_modulo_revisiones on modulo_revisiones;
create policy aprobador_insert_modulo_revisiones on modulo_revisiones
  for insert to authenticated
  with check (
    public.puede_aprobar((select m.proyecto_id from modulos m where m.id = modulo_id))
  );

-- Aprobar una tarea (revision → hecho) exige permiso en su proyecto. Las
-- llamadas sin usuario (service_role: webhook de GitHub, cron) pasan.
create or replace function public.tareas_validar_aprobacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proyecto uuid;
begin
  if old.estado = 'revision' and new.estado = 'hecho'
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    select m.proyecto_id into v_proyecto from modulos m where m.id = new.modulo_id;
    if not public.puede_aprobar(v_proyecto) then
      raise exception 'Solo el responsable de visión del proyecto puede aprobar esta tarea.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tareas_validar_aprobacion on tareas;
create trigger tareas_validar_aprobacion
  before update of estado on tareas
  for each row execute function public.tareas_validar_aprobacion();

-- ── Salud de la cartera ──────────────────────────────────────────────────────
-- Una fila por proyecto con los indicadores de la reunión semanal de socios.
-- security_invoker: respeta el RLS de quien consulta.
create or replace view public.v_salud_proyectos
with (security_invoker = true) as
select
  p.id as proyecto_id,
  count(t.id)::int                                                            as total,
  count(t.id) filter (where t.estado = 'hecho')::int                           as hechas,
  count(t.id) filter (where t.estado <> 'hecho' and t.fecha < current_date)::int as vencidas,
  count(t.id) filter (where t.estado = 'revision')::int                        as en_revision,
  count(t.id) filter (where t.estado = 'en_curso')::int                        as en_curso,
  count(t.id) filter (where t.estado <> 'hecho' and t.responsable_id is null)::int as sin_asignar,
  count(t.id) filter (where t.tipo = 'correccion')::int                        as correcciones,
  count(t.id) filter (where t.estado <> 'hecho' and t.prioridad = 'alta')::int  as alta_abiertas,
  greatest(
    p.created_at,
    max(t.updated_at),
    (select max(c.created_at)
       from comentarios c
       left join tareas tc on tc.id = c.tarea_id
       join modulos mc on mc.id = coalesce(tc.modulo_id, c.modulo_id)
      where mc.proyecto_id = p.id),
    (select max(me.created_at) from mensajes me where me.proyecto_id = p.id)
  ) as ultima_actividad
from proyectos p
left join modulos m on m.proyecto_id = p.id
left join tareas t on t.modulo_id = m.id
group by p.id;

grant select on public.v_salud_proyectos to authenticated;

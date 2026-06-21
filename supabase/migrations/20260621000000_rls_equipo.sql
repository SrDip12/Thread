-- Endurecer RLS: de "cualquier autenticado lee/escribe todo" a modelo EQUIPO ÚNICO.
-- Toda persona activa (mapeada a su auth.users) lee y escribe todos los proyectos;
-- los PO suman permisos: gestionar `personas` y borrar `proyectos`.
-- El rol `anon` sigue sin acceso (todas las políticas son `to authenticated`).

-- ── Identidad auth ↔ persona ──────────────────────────────────────────────────
-- Hasta ahora la app matcheaba por email. Agregamos user_id para usar auth.uid()
-- en las políticas (eficiente, sobrevive a cambios de email) y backfilleamos.
alter table personas
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists idx_personas_user_id on personas (user_id) where user_id is not null;

update personas p
  set user_id = u.id
  from auth.users u
  where p.user_id is null and lower(u.email) = lower(p.email);

-- ── Helpers ───────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: corren con privilegios del owner y BYPASSAN RLS, así evitan
-- la recursión infinita al consultar `personas` desde políticas de `personas`.
-- El OR-email evita el huevo-y-gallina: un usuario nuevo cuyo email ya está en
-- `personas` cuenta como miembro aunque user_id todavía no esté backfilleado.
create or replace function public.es_miembro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from personas
    where activo
      and (user_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email'))
  );
$$;

create or replace function public.es_po()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from personas
    where activo and rol = 'po'
      and (user_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email'))
  );
$$;

-- ── Bajar las políticas permisivas viejas ─────────────────────────────────────
do $$
declare
  t text;
  tablas text[] := array[
    'personas','proyectos','modulos','sprints','reuniones','tareas',
    'comentarios','pulsos','reunion_asistentes','clientes','modulo_revisiones'
  ];
begin
  foreach t in array tablas loop
    execute format('drop policy if exists %I on %I', 'auth_all_' || t, t);
  end loop;
end $$;

-- ── Políticas nuevas ──────────────────────────────────────────────────────────
-- Tablas "generales": cualquier miembro hace todo.
do $$
declare
  t text;
  generales text[] := array[
    'proyectos','modulos','sprints','reuniones','tareas',
    'comentarios','pulsos','reunion_asistentes','clientes','modulo_revisiones'
  ];
begin
  foreach t in array generales loop
    execute format(
      'create policy %I on %I for select to authenticated using (public.es_miembro())',
      'miembro_select_' || t, t
    );
    execute format(
      'create policy %I on %I for insert to authenticated with check (public.es_miembro())',
      'miembro_insert_' || t, t
    );
    execute format(
      'create policy %I on %I for update to authenticated using (public.es_miembro()) with check (public.es_miembro())',
      'miembro_update_' || t, t
    );
    execute format(
      'create policy %I on %I for delete to authenticated using (public.es_miembro())',
      'miembro_delete_' || t, t
    );
  end loop;
end $$;

-- `proyectos`: borrar es solo de PO (el resto ya quedó cubierto arriba).
drop policy if exists miembro_delete_proyectos on proyectos;
create policy po_delete_proyectos on proyectos
  for delete to authenticated using (public.es_po());

-- `personas`: lectura para cualquier miembro; alta/edición/baja solo PO (gestión de equipo).
create policy miembro_select_personas on personas
  for select to authenticated using (public.es_miembro());
create policy po_insert_personas on personas
  for insert to authenticated with check (public.es_po());
create policy po_update_personas on personas
  for update to authenticated using (public.es_po()) with check (public.es_po());
create policy po_delete_personas on personas
  for delete to authenticated using (public.es_po());

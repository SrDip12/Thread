-- Seguridad + avisos del lado del servidor.
--
-- 1. Cierra el RLS de las tablas que quedaron con `using (true)` después de
--    `rls_equipo`: notificaciones, tarea_dependencias y mensajes.
-- 2. Las notificaciones in-app dejan de insertarse desde el cliente (cualquiera
--    podía fabricar avisos a nombre de otro): las generan triggers sobre
--    `tareas` y `comentarios`, y los vencimientos una función invocable por el
--    cron diario (/api/digest) o por cada persona para sí misma.
--
-- Los textos se guardan en español como respaldo; la UI arma el mensaje por
-- `tipo`/`evento` con i18n, así que se ven en el idioma activo.

-- ── Identidad: persona del usuario autenticado ──────────────────────────────
create or replace function public.persona_actual_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from personas
  where activo
    and (user_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email'))
  order by (user_id = auth.uid()) desc nulls last
  limit 1;
$$;

-- Personas mencionadas con @nombre (con o sin espacios) en un texto.
create or replace function public.personas_mencionadas(p_texto text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from personas
  where activo
    and (
      position('@' || lower(regexp_replace(nombre, '\s+', '', 'g')) in lower(p_texto)) > 0
      or position('@' || lower(nombre) in lower(p_texto)) > 0
    );
$$;

-- ── Notificaciones: columnas nuevas ─────────────────────────────────────────
-- `evento` distingue sub-casos de un tipo (revision: envio_revision|aprobo|devolvio)
-- para que la UI lo traduzca en vez de mostrar el texto persistido.
alter table notificaciones add column if not exists evento text;
create index if not exists idx_notificaciones_persona_fecha
  on notificaciones (persona_id, created_at desc);

-- Dedupe de correos por comentario (lo marca /api/enviar-correo).
alter table comentarios add column if not exists correo_enviado_at timestamptz;

-- ── RLS: notificaciones (cada uno ve y marca solo las suyas) ─────────────────
drop policy if exists auth_all_notificaciones on notificaciones;
drop policy if exists propia_select_notificaciones on notificaciones;
drop policy if exists propia_update_notificaciones on notificaciones;
drop policy if exists propia_delete_notificaciones on notificaciones;

create policy propia_select_notificaciones on notificaciones
  for select to authenticated using (persona_id = public.persona_actual_id());
create policy propia_update_notificaciones on notificaciones
  for update to authenticated
  using (persona_id = public.persona_actual_id())
  with check (persona_id = public.persona_actual_id());
create policy propia_delete_notificaciones on notificaciones
  for delete to authenticated using (persona_id = public.persona_actual_id());
-- Sin política de INSERT: solo los triggers/funciones SECURITY DEFINER insertan.
revoke insert on notificaciones from authenticated;

-- ── RLS: tarea_dependencias (modelo equipo, como el resto) ───────────────────
drop policy if exists auth_all_tarea_dependencias on tarea_dependencias;
drop policy if exists miembro_select_tarea_dependencias on tarea_dependencias;
drop policy if exists miembro_insert_tarea_dependencias on tarea_dependencias;
drop policy if exists miembro_delete_tarea_dependencias on tarea_dependencias;

create policy miembro_select_tarea_dependencias on tarea_dependencias
  for select to authenticated using (public.es_miembro());
create policy miembro_insert_tarea_dependencias on tarea_dependencias
  for insert to authenticated with check (public.es_miembro());
create policy miembro_delete_tarea_dependencias on tarea_dependencias
  for delete to authenticated using (public.es_miembro());

-- ── RLS: mensajes (leer miembros; escribir/borrar solo lo propio) ────────────
drop policy if exists auth_all_mensajes on mensajes;
drop policy if exists miembro_select_mensajes on mensajes;
drop policy if exists propio_insert_mensajes on mensajes;
drop policy if exists propio_delete_mensajes on mensajes;

create policy miembro_select_mensajes on mensajes
  for select to authenticated using (public.es_miembro());
create policy propio_insert_mensajes on mensajes
  for insert to authenticated
  with check (public.es_miembro() and autor_id = public.persona_actual_id());
create policy propio_delete_mensajes on mensajes
  for delete to authenticated using (autor_id = public.persona_actual_id());

-- ── Helper de inserción (no expuesto a clientes) ─────────────────────────────
create or replace function public._notificar(
  p_persona uuid, p_autor uuid, p_tipo text, p_evento text,
  p_texto text, p_tarea uuid, p_proyecto uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into notificaciones (persona_id, autor_id, tipo, evento, texto, tarea_id, proyecto_id)
  select p_persona, p_autor, p_tipo, p_evento, p_texto, p_tarea, p_proyecto
  where p_persona is not null and p_persona is distinct from p_autor;
$$;
revoke all on function public._notificar(uuid, uuid, text, text, text, uuid, uuid)
  from public, anon, authenticated;

-- ── Trigger: tareas → asignación y transiciones de revisión ──────────────────
create or replace function public.tareas_notificar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid := public.persona_actual_id();
  v_proyecto uuid;
  v_vision   uuid;
begin
  select m.proyecto_id, p.responsable_vision_id
    into v_proyecto, v_vision
  from modulos m join proyectos p on p.id = m.proyecto_id
  where m.id = new.modulo_id;

  if new.responsable_id is not null
     and (tg_op = 'INSERT' or new.responsable_id is distinct from old.responsable_id) then
    perform public._notificar(new.responsable_id, v_actor, 'asignacion', null,
      format('Te asignó la tarea "%s"', new.titulo), new.id, v_proyecto);
  end if;

  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    if new.estado = 'revision' then
      perform public._notificar(v_vision, v_actor, 'revision', 'envio_revision',
        format('envió a revisión la tarea "%s"', new.titulo), new.id, v_proyecto);
    elsif old.estado = 'revision' and new.estado = 'hecho' then
      perform public._notificar(new.responsable_id, v_actor, 'revision', 'aprobo',
        format('aprobó tu tarea "%s"', new.titulo), new.id, v_proyecto);
    elsif old.estado = 'revision' then
      perform public._notificar(new.responsable_id, v_actor, 'revision', 'devolvio',
        format('devolvió tu tarea "%s"', new.titulo), new.id, v_proyecto);
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists tareas_notificar on tareas;
create trigger tareas_notificar
  after insert or update of responsable_id, estado on tareas
  for each row execute function public.tareas_notificar();

-- ── Trigger: comentarios → mención, pregunta al PO, comentario al responsable ─
create or replace function public.comentarios_notificar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo    text;
  v_resp      uuid;
  v_proyecto  uuid;
  v_vision    uuid;
  v_menciones uuid[];
  v_extracto  text := left(new.texto, 50);
  pid         uuid;
begin
  if new.tarea_id is null then
    return null;
  end if;

  select t.titulo, t.responsable_id, m.proyecto_id, p.responsable_vision_id
    into v_titulo, v_resp, v_proyecto, v_vision
  from tareas t
  join modulos m on m.id = t.modulo_id
  join proyectos p on p.id = m.proyecto_id
  where t.id = new.tarea_id;

  select coalesce(array_agg(x), '{}')
    into v_menciones
  from public.personas_mencionadas(new.texto) as x
  where x <> new.autor_id;

  foreach pid in array v_menciones loop
    perform public._notificar(pid, new.autor_id, 'mencion', null,
      format('Te mencionó en la tarea "%s": "%s..."', v_titulo, v_extracto),
      new.tarea_id, v_proyecto);
  end loop;

  if new.para_po and v_vision is not null and not (v_vision = any (v_menciones)) then
    perform public._notificar(v_vision, new.autor_id, 'pregunta', null,
      format('Te hizo una pregunta en la tarea "%s": "%s..."', v_titulo, v_extracto),
      new.tarea_id, v_proyecto);
  end if;

  if v_resp is not null
     and not (v_resp = any (v_menciones))
     and not (new.para_po and v_vision is not distinct from v_resp) then
    perform public._notificar(v_resp, new.autor_id, 'comentario', null,
      format('Comentó en tu tarea "%s": "%s..."', v_titulo, v_extracto),
      new.tarea_id, v_proyecto);
  end if;

  return null;
end;
$$;

drop trigger if exists comentarios_notificar on comentarios;
create trigger comentarios_notificar
  after insert on comentarios
  for each row execute function public.comentarios_notificar();

-- ── Vencimientos ─────────────────────────────────────────────────────────────
-- Tareas no hechas que vencen en ≤2 días (o ya vencidas), un aviso por tarea.
-- service_role (cron) → todas las personas (o p_persona); authenticated → solo la propia.
create or replace function public.generar_avisos_vencimiento(p_persona uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona uuid;
  n integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    v_persona := p_persona;
  else
    v_persona := public.persona_actual_id();
    if v_persona is null then
      return 0;
    end if;
  end if;

  insert into notificaciones (persona_id, autor_id, tipo, texto, tarea_id, proyecto_id)
  select t.responsable_id, null, 'vencimiento',
         format('La tarea "%s" vence pronto o ya expiró (%s)', t.titulo, t.fecha),
         t.id, m.proyecto_id
  from tareas t
  join modulos m on m.id = t.modulo_id
  join personas pe on pe.id = t.responsable_id and pe.activo
  where t.estado <> 'hecho'
    and t.fecha is not null
    and t.fecha <= current_date + 2
    and (v_persona is null or t.responsable_id = v_persona)
    and not exists (
      select 1 from notificaciones n
      where n.tipo = 'vencimiento' and n.tarea_id = t.id and n.persona_id = t.responsable_id
    );

  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.generar_avisos_vencimiento(uuid) from public, anon;
grant execute on function public.generar_avisos_vencimiento(uuid) to authenticated, service_role;

grant execute on function public.persona_actual_id() to authenticated;
grant execute on function public.personas_mencionadas(text) to authenticated;

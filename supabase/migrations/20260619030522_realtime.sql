-- Habilita Supabase Realtime para tareas y comentarios.
-- El cliente se suscribe a postgres_changes; Realtime respeta RLS (las políticas
-- permisivas para authenticated ya permiten leer estos cambios).

alter publication supabase_realtime add table tareas;
alter publication supabase_realtime add table comentarios;

-- REPLICA IDENTITY FULL para que los eventos UPDATE/DELETE traigan la fila vieja
-- completa (necesario para filtrar por modulo_id en el cliente al borrar/mover).
alter table tareas replica identity full;
alter table comentarios replica identity full;

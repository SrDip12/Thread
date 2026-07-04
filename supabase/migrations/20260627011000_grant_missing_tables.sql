-- Grant permissions on missing tables to the authenticated role.
-- Postgres 15+ doesn't grant public schema permissions to roles by default,
-- so any new tables created in migrations need explicit grants.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proyecto_personas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarea_dependencias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificaciones TO authenticated;

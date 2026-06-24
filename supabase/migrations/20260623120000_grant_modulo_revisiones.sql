-- Fix: la tabla `modulo_revisiones` (creada en 20260619080000) quedó sin GRANT
-- de privilegios al rol `authenticated`. Las políticas RLS no alcanzan: Postgres
-- chequea primero el privilegio de tabla, y sin él el INSERT falla con
-- "42501: permission denied for table modulo_revisiones". Resultado: devolver/
-- aprobar un módulo lanzaba error, la mutación hacía rollback y el módulo seguía
-- "en revisión". El resto de las tablas sí tienen estos grants.
grant select, insert, update, delete on public.modulo_revisiones to authenticated;

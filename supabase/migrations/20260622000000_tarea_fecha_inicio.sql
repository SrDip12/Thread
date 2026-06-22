-- Gantt por proyecto: la tarea gana una fecha de inicio opcional.
-- `fecha` sigue siendo el vencimiento. Con ambas se dibuja una barra;
-- con solo `fecha` se dibuja un hito (diamante). Backlog/datos viejos quedan nulos.
alter table public.tareas add column if not exists fecha_inicio date;

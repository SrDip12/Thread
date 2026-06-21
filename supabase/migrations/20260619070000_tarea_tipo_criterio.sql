-- Dos ejes transversales en tareas:
--   tipo     → distinguir trabajo nuevo ('tarea') de arreglos ('correccion'),
--              para ver la tasa de corrección (crear vs arreglar).
--   criterio → definición de "listo" (¿cómo sé que está terminada?).

-- Guarda por si el enum ya existiera (idempotente).
do $$
begin
  create type tipo_tarea as enum ('tarea', 'correccion');
exception
  when duplicate_object then null;
end $$;

alter table tareas
  add column if not exists tipo tipo_tarea not null default 'tarea';

alter table tareas
  add column if not exists criterio text;

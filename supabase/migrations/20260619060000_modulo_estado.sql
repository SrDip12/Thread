-- Ciclo de vida de los módulos: la unidad que se cierra.
-- Enum `estado_modulo` + columna `modulos.estado` (default 'abierto').

-- Guarda por si el enum ya existiera (idempotente).
do $$
begin
  create type estado_modulo as enum ('abierto', 'en_revision', 'cerrado');
exception
  when duplicate_object then null;
end $$;

alter table modulos
  add column if not exists estado estado_modulo not null default 'abierto';

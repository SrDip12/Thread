-- Definición de producto por proyecto: el norte contra el que se valida todo.
-- Aditiva: tres campos de texto en proyectos (backlog/migración sin recrear nada).
alter table proyectos
  add column if not exists que_es      text,
  add column if not exists para_quien  text,
  add column if not exists problema    text;

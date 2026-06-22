-- Marca de cuándo el módulo entró a 'en_revision', para priorizar la bandeja
-- (más antiguo primero) y mostrar "en revisión desde hace X". La setea la app
-- al transicionar; queda con el último valor (solo se lee mientras en_revision).
alter table modulos
  add column if not exists en_revision_at timestamptz;

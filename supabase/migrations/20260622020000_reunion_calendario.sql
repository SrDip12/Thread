-- Calendario de reuniones: descripción de lo que se hará, hora del día y alerta.
-- `fecha` sigue siendo el día (timestamptz). `hora` opcional ubica la reunión en el día.
-- `alerta_min` = minutos antes (de fecha+hora) para recordar; null = sin alerta.
alter table public.reuniones add column if not exists descripcion text;
alter table public.reuniones add column if not exists hora time;
alter table public.reuniones add column if not exists alerta_min int;

-- Esquema inicial de Thread.
-- Enums para campos acotados (el generador de tipos los mapea a uniones de TS).

create type rol_persona     as enum ('po', 'dev');
create type estado_proyecto as enum ('activo', 'pausado', 'cerrado');
create type estado_tarea    as enum ('proximo', 'en_curso', 'hecho');
create type estado_sprint   as enum ('planificado', 'activo', 'cerrado');
create type tipo_reunion     as enum ('sprint_planning', 'retro', 'sync', 'otro');

-- ── Tablas ───────────────────────────────────────────────────────────────────

create table personas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  email      text not null unique,
  rol        rol_persona not null,
  color      text not null default '#c96442',
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create table proyectos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  color       text not null default '#c96442',
  estado      estado_proyecto not null default 'activo',
  created_at  timestamptz not null default now()
);

create table modulos (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos (id) on delete cascade,
  nombre      text not null,
  descripcion text,
  orden       integer not null default 0
);

create table sprints (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references proyectos (id) on delete cascade,
  nombre         text not null,
  objetivo       text,
  fecha_inicio   date,
  fecha_fin      date,
  estado         estado_sprint not null default 'planificado',
  cierre_logros  text,
  cierre_pegados text,
  cierre_cambio  text,
  created_at     timestamptz not null default now()
);

create table reuniones (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos (id) on delete cascade,
  sprint_id   uuid references sprints (id) on delete set null,
  tipo        tipo_reunion not null,
  titulo      text not null,
  fecha       timestamptz not null default now(),
  notas       text,
  created_at  timestamptz not null default now()
);

create table tareas (
  id             uuid primary key default gen_random_uuid(),
  modulo_id      uuid not null references modulos (id) on delete cascade,
  titulo         text not null,
  descripcion    text,
  responsable_id uuid references personas (id) on delete set null,
  estado         estado_tarea not null default 'proximo',
  fecha          date,
  sprint_id      uuid references sprints (id) on delete set null,
  reunion_id     uuid references reuniones (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table comentarios (
  id         uuid primary key default gen_random_uuid(),
  tarea_id   uuid not null references tareas (id) on delete cascade,
  autor_id   uuid not null references personas (id) on delete cascade,
  texto      text not null,
  para_po    boolean not null default false,
  resuelto   boolean not null default false,
  created_at timestamptz not null default now()
);

create table pulsos (
  id         uuid primary key default gen_random_uuid(),
  sprint_id  uuid not null references sprints (id) on delete cascade,
  persona_id uuid not null references personas (id) on delete cascade,
  texto      text not null,
  created_at timestamptz not null default now()
);

create table reunion_asistentes (
  reunion_id uuid not null references reuniones (id) on delete cascade,
  persona_id uuid not null references personas (id) on delete cascade,
  primary key (reunion_id, persona_id)
);

-- Índices en las FKs más consultadas.
create index idx_modulos_proyecto    on modulos (proyecto_id);
create index idx_tareas_modulo       on tareas (modulo_id);
create index idx_tareas_responsable  on tareas (responsable_id);
create index idx_tareas_sprint       on tareas (sprint_id);
create index idx_tareas_reunion      on tareas (reunion_id);
create index idx_comentarios_tarea   on comentarios (tarea_id);
create index idx_sprints_proyecto    on sprints (proyecto_id);
create index idx_pulsos_sprint       on pulsos (sprint_id);
create index idx_reuniones_proyecto  on reuniones (proyecto_id);

-- ── Trigger updated_at en tareas ──────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tareas_set_updated_at
  before update on tareas
  for each row
  execute function set_updated_at();

-- ── RLS permisivo (cualquier usuario autenticado lee/escribe todo) ────────────
-- Punto de partida. Ver CLAUDE.md → "Endurecer RLS" para el plan de cierre.

alter table personas           enable row level security;
alter table proyectos          enable row level security;
alter table modulos            enable row level security;
alter table sprints            enable row level security;
alter table reuniones          enable row level security;
alter table tareas             enable row level security;
alter table comentarios        enable row level security;
alter table pulsos             enable row level security;
alter table reunion_asistentes enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'personas','proyectos','modulos','sprints','reuniones',
    'tareas','comentarios','pulsos','reunion_asistentes'
  ]
  loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      'auth_all_' || t, t
    );
  end loop;
end $$;

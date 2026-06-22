// Claves de query centralizadas y tipadas para TanStack Query.
// Una factory por entidad. Las listas con filtro incluyen el filtro en la key.

export const qk = {
  proyectos: {
    all: ['proyectos'] as const,
    list: () => [...qk.proyectos.all, 'list'] as const,
  },
  modulos: {
    all: ['modulos'] as const,
    byProyecto: (proyectoId: string) => [...qk.modulos.all, { proyectoId }] as const,
  },
  tareas: {
    all: ['tareas'] as const,
    byModulo: (moduloId: string) => [...qk.tareas.all, { moduloId }] as const,
    byProyecto: (proyectoId: string) => [...qk.tareas.all, 'proyecto', { proyectoId }] as const,
    mias: (personaId: string) => [...qk.tareas.all, 'mias', { personaId }] as const,
    bySprint: (sprintId: string) => [...qk.tareas.all, 'sprint', { sprintId }] as const,
    backlog: (proyectoId: string) => [...qk.tareas.all, 'backlog', { proyectoId }] as const,
    byReunion: (reunionId: string) => [...qk.tareas.all, 'reunion', { reunionId }] as const,
    correcciones: (proyectoId: string) => [...qk.tareas.all, 'correcciones', { proyectoId }] as const,
    statsProyectos: () => [...qk.tareas.all, 'stats-proyectos'] as const,
  },
  sprints: {
    all: ['sprints'] as const,
    byProyecto: (proyectoId: string) => [...qk.sprints.all, { proyectoId }] as const,
    activo: (proyectoId: string) => [...qk.sprints.all, 'activo', { proyectoId }] as const,
  },
  pulsos: {
    all: ['pulsos'] as const,
    bySprint: (sprintId: string) => [...qk.pulsos.all, { sprintId }] as const,
  },
  reuniones: {
    all: ['reuniones'] as const,
    list: (proyectoId: string | null) => [...qk.reuniones.all, 'list', { proyectoId }] as const,
    byId: (reunionId: string) => [...qk.reuniones.all, { reunionId }] as const,
    asistentes: (reunionId: string) => [...qk.reuniones.all, 'asistentes', { reunionId }] as const,
  },
  comentarios: {
    all: ['comentarios'] as const,
    byTarea: (tareaId: string) => [...qk.comentarios.all, { tareaId }] as const,
    byModulo: (moduloId: string) => [...qk.comentarios.all, 'modulo', { moduloId }] as const,
    paraPo: () => [...qk.comentarios.all, 'para-po'] as const,
  },
  revisiones: {
    all: ['revisiones'] as const,
    enRevision: () => [...qk.revisiones.all, 'en-revision'] as const,
  },
  personas: {
    all: ['personas'] as const,
    list: () => [...qk.personas.all, 'list'] as const,
  },
  clientes: {
    all: ['clientes'] as const,
    byProyecto: (proyectoId: string) => [...qk.clientes.all, { proyectoId }] as const,
  },
  mensajes: {
    all: ['mensajes'] as const,
    byProyecto: (proyectoId: string) => [...qk.mensajes.all, { proyectoId }] as const,
  },
} as const

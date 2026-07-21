# Thread

App web de gestión de proyectos/tareas. UI **en español**.

## Stack

- **React 19** + **TypeScript** (modo estricto)
- **Vite 6** (dev server y build)
- **Tailwind CSS v4** vía `@tailwindcss/vite` (sin `tailwind.config.js`; tokens en `src/index.css` con `@theme`)
- **React Router v7** (`react-router-dom`, modo declarativo)
- **@tanstack/react-query** (estado de servidor / cache)
- **@supabase/supabase-js** (backend: datos + auth)
- Deploy: **Vercel** (+ Edge Functions en `/api`)

## Estructura

```
/design            Export de Claude Design. REFERENCIA VISUAL. NO MODIFICAR.
/api               Vercel Edge Functions (cada .ts = ruta /api/<archivo>).
/public            Estáticos. vercel.json hace el fallback SPA (rewrites).
/src
  /components       Componentes compartidos (Layout, etc.)
  /lib              Clientes/infra (supabase.ts)
  /pages            Vistas por ruta
  App.tsx           Definición de rutas
  main.tsx          Entry: StrictMode + QueryClient + Router
  index.css         Tailwind + tokens de tema (@theme)
  vite-env.d.ts     Tipos de import.meta.env
CLAUDE.md
```

## Convenciones

- **Componentes funcionales** únicamente. Nada de clases.
- **Hooks** para lógica con estado/efectos; data de servidor siempre vía React Query (no `useEffect` + `fetch`).
- **TypeScript estricto**: sin `any`, sin variables/parámetros sin usar (el build falla). Tipa props con `type`.
- **UI en español**: textos, rutas (`/mis-tareas`, `/para-mi`) y nombres de cara al usuario en español.
- Estilos con clases Tailwind y los tokens de `@theme` (`bg-canvas`, `text-ink`, `bg-brand`, `border-line`, `text-muted`...). No CSS suelto salvo en `index.css`.
- La paleta y tipografía (Manrope) salen de `/design`. Al construir vistas, mirá `/design` como referencia.

## Comandos

```
npm run dev         # servidor de desarrollo (Vite)
npm run build       # tsc -b + vite build
npm run typecheck   # solo chequeo de tipos
npm run preview     # sirve el build de prod
```

## Env

Copiar `.env.example` a `.env` y completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
En producción, definirlas en Cloudflare Pages.

## Base de datos (Supabase)

Estructura en `/supabase`:
- `migrations/` — SQL versionado. `…_init_schema.sql` crea enums, tablas, índices, trigger y RLS.
- `seed.sql` — datos de ejemplo (2 proyectos con módulos/tareas, 4 personas, 1 sprint activo, 1 planning con tareas derivadas).
- `config.toml` — config del stack local.

### Esquema (resumen)

`personas` · `proyectos` · `modulos`(→proyecto) · `sprints`(→proyecto) · `reuniones`(→proyecto, →sprint?) · `tareas`(→modulo, →persona?, →sprint?, →reunion?) · `comentarios`(→tarea, →persona) · `pulsos`(→sprint, →persona) · `reunion_asistentes`(→reunion, →persona, PK compuesta) · `mensajes`(→proyecto, →persona) chat de equipo.

Campos acotados como **enums** Postgres: `rol_persona`, `estado_proyecto`, `estado_tarea`, `estado_sprint`, `tipo_reunion`. Borrado: FKs de jerarquía en `cascade`; referencias opcionales en `set null`. `tareas.updated_at` lo mantiene el trigger `tareas_set_updated_at`.

### Aplicar y tipos

```
supabase start                              # levanta Postgres local (requiere Docker); aplica migraciones + seed
supabase db reset                           # reaplica migraciones + seed desde cero
supabase gen types typescript --local > src/lib/database.types.ts   # regenerar tipos
```

Para entorno remoto: `supabase link --project-ref <ref>`, `supabase db push`, y `gen types --linked`.
**Regenerá `src/lib/database.types.ts` después de cada cambio de esquema.** Los tipos actuales fueron escritos a mano (no había Docker al crearlos); al regenerar incluirán el bloque `Relationships`.

### RLS — estado actual y cómo endurecer

Hoy: RLS **activado** en todas las tablas con una política permisiva `auth_all_<tabla>` → cualquier usuario **autenticado** lee y escribe todo. El rol `anon` no tiene acceso. Punto de partida, no para producción con datos sensibles.

Plan de cierre (cuando haya modelo de acceso real):
1. Mapear `auth.users.id` ↔ `personas` (agregar `personas.user_id uuid references auth.users` o usar `personas.id = auth.uid()`).
2. Reemplazar cada `auth_all_*` por políticas por operación (`select`/`insert`/`update`/`delete`) según pertenencia: ej. una persona solo edita tareas de proyectos donde es miembro.
3. Guardar el **rol** (`po`/`dev`) en `app_metadata` (no en `user_metadata`, es editable por el usuario) y leerlo con `auth.jwt()` para permisos de PO.
4. Recordar: un `UPDATE` necesita también policy de `SELECT` (si no, devuelve 0 filas sin error).
5. Verificar con `supabase db advisors` (lints de seguridad/RLS) antes de subir.

## Datos y Auth

**Regla dura: ningún componente importa `supabase` ni hace queries.** Toda la I/O pasa por:

- `src/auth/AuthProvider.tsx` — `<AuthProvider>` (en `main.tsx`, dentro de QueryClient) + hook `useAuth()` → `{ session, persona, cargando, signOut }`. Login email+password en `src/components/Login.tsx`. El gate de estados (cargando / sin sesión / persona no registrada / ok) está en `App.tsx`. `persona` = la fila de `personas` cuyo email coincide con el usuario autenticado (el "yo").
- `src/data/<entidad>.ts` — hooks TanStack Query por entidad (proyectos, modulos, tareas, comentarios, personas). Listado + `useCrear*` / `useActualizar*` / `useEliminar*`. Todas las mutaciones con **optimistic update** (onMutate snapshot + setQueryData, onError rollback, onSettled invalidate).
- `src/data/queryKeys.ts` — `qk`, claves centralizadas (las listas filtradas incluyen el filtro en la key).

Para una entidad/operación nueva: agregá el hook en su módulo de `src/data/`, no en el componente.

## Diseño

`/design` (export de Claude Design) es la fuente visual de la verdad — **no modificar**. Lenguaje: minimalista cálido, lienzo hueso `#faf9f7`, acento terracota `#c96442`, un color de acento por proyecto (`proyectos.color`), estados gris/azul/verde, tipografía Manrope + JetBrains Mono (métricas).

- Tokens estáticos → `src/index.css` (`@theme`): `bg-canvas`, `text-ink`, `border-line`, `bg-surface`, `text-muted`, `bg-brand`, `bg-track`, etc.
- **Tema oscuro**: `:root.dark` re-mapea los mismos tokens; ningún componente conoce el tema. Por eso **no se escriben hex sueltos** en `.tsx`/`ui.ts` — todo color de estado sale de los semánticos (`--color-danger|warn|info|ok|neutral|plum` con sus `-tint`/`-line`/`-dot`), la elevación de `--shadow-pop`/`--shadow-card`, el velo de modal de `--color-scrim`, y el texto sobre un relleno `bg-brand` usa `text-on-brand` (blanco en claro, oscuro en el tema oscuro, donde la terracota se aclara). Únicos hex legítimos: la paleta de acentos por proyecto (`COLORES_PROYECTO`, `PALETA` de Equipo) y los sólidos `--color-*-solid` de botones destructivos/confirmar, iguales en ambos temas.
- Colores dinámicos (acento por proyecto, estados de tarea) → inline desde `src/lib/ui.ts` (`estadoVM`, `iniciales`, `fmtFecha`).
- Presentacionales reutilizables → `src/components/ui.tsx` (`Avatar`, `AvatarStack`, `EstadoChip`, `FechaTag`, `ProgressBar`, `Eyebrow`, `InlineEdit`, `Skeleton`, `EmptyState`).
- Señal de vencimiento: `fechaVM`/`diasHasta` en `src/lib/ui.ts` + `FechaTag` (rojo vencida, marca hoy, ámbar mañana). Usada en todas las filas de tarea.
- Pantallas en `src/pages/`: `Hoy` (home: vencidas/para hoy/semana/reuniones del día), `Proyectos`, `ProyectoDetalle` (módulos = secciones, filas densas, panel lateral `TareaPanel`, vista Kanban), `Sprint`, `ProyectoGantt`, `MisTareas` (filtros pendientes/hechas, orden por vencimiento), `ParaMi`, `Reuniones`, `ReunionDetalle`, `Calendario` (reuniones + mis vencimientos), `Revisiones` (tabs: **Tareas** en estado `revision` para aprobar/devolver con motivo + **Módulos** con la compuerta del responsable de visión), `Equipo`.

## Sprints (liviano)

Ventana de tiempo **ortogonal a los módulos**: la tarea sigue en su módulo y gana `sprint_id` opcional; el backlog = tareas sin sprint. Sin story points / velocity / burndown. Datos en `src/data/sprints.ts` + `src/data/pulsos.ts`; UI en `src/pages/Sprint.tsx` (ruta `/proyectos/:id/sprint`). La página muestra **todos** los sprints del proyecto (selector de pills; ninguno queda invisible aunque esté `planificado`/`cerrado`): planificados se pueden **Iniciar** (bloqueado si hay otro activo), cerrados quedan read-only con su resumen de cierre. Incluye: crear sprint rápido (entra `planificado` si ya hay uno activo), progreso (hechas/total) + chip de plazo, quick-add, mover backlog↔sprint, **pulso async** y **cierre** (logros/pegados/cambio; `useCerrarSprint` devuelve las no terminadas al backlog en un UPDATE).

## Reuniones + extracción con IA

Registra reuniones (no las agenda) y convierte notas en tareas. Datos `src/data/reuniones.ts`; UI `src/pages/Reuniones.tsx` (`/reuniones`, filtrable por proyecto) y `src/pages/ReunionDetalle.tsx` (`/reuniones/:id`: encabezado proyecto/tipo/fecha/sprint/asistentes, notas con autoguardado, extracción IA, tareas creadas).

**Extracción IA** → `api/extraer-tareas.ts` (Vercel Edge Function, `POST /api/extraer-tareas`):
- Proveedor: **Groq** (API compatible con OpenAI, `POST /openai/v1/chat/completions`). Modelo en la constante `MODEL = 'llama-3.3-70b-versatile'` (cambiar ahí). Usa `response_format: json_object`.
- API key: **env var de Vercel** `GROQ_API_KEY` (`process.env.GROQ_API_KEY`, header `Authorization: Bearer`), nunca en el cliente. Setear: dashboard → Settings → Environment Variables, o `vercel env add GROQ_API_KEY`.
- Cada función declara `export const config = { runtime: 'edge' }` y exporta `default async function handler(request: Request)`. La otra función IA es `api/analizar-proyecto.ts` (cliente `src/lib/analizarProyecto.ts`).
- Recibe `{ notas, personas[], modulos[] }`, devuelve `{ tareas: [{ titulo, responsable_sugerido, modulo_sugerido, fecha }] }` (validado/tipado). Cliente: `src/lib/extraer.ts`.
- Las tareas **nunca** se crean sin revisión: el detalle muestra una vista editable (responsable/módulo/fecha) antes de confirmar; al confirmar se crean con `reunion_id` + `sprint_id`.
- **Dev local**: `vite dev` NO ejecuta Functions. Para probar la IA local: `vercel dev` (sirve `/api`) con `GROQ_API_KEY` en `.env.local`, o probá contra el deploy.

## Realtime

Cambios en `tareas` y `comentarios` se reflejan en vivo entre miembros. Hook `src/data/realtime.ts` → `useRealtimeProyecto(proyectoId, moduloIds)`: se suscribe a `postgres_changes` e **invalida** las queries de TanStack (`qk.tareas.all` / `qk.comentarios.all`), que solo refetchean las vistas montadas. Montado en `ProyectoDetalle` y `Sprint`, así la suscripción vive solo con el proyecto abierto. Filtra tareas por `modulo_id` del proyecto en el cliente (Realtime solo filtra por una columna en server).

Requiere la migración `…_realtime.sql` (agrega las tablas a la publicación `supabase_realtime` + `replica identity full`). Aplicar en el SQL editor o `supabase db push`.

**Chat de equipo (tiempo real)** → tabla `mensajes`(→proyecto, →persona), datos en `src/data/mensajes.ts` (listar + `useCrearMensaje` optimista + `useRealtimeChat`). UI: widget flotante `src/components/ChatProyecto.tsx`, montado en `ProyectoDetalle` (scoped al proyecto abierto). Realtime filtra por `proyecto_id` server-side (postgres_changes, una columna). Migración `…_chat.sql` agrega `mensajes` a la publicación `supabase_realtime`. **Aplicar con `supabase db push` (o SQL editor) antes de usar.**

## Deploy (Vercel)

Build de Vite: **build command** `npm run build`, **output dir** `dist`. Node 20 (`.node-version`). Las **Edge Functions** de `/api` se despliegan automáticamente junto al sitio; `POST /api/extraer-tareas` y `POST /api/analizar-proyecto` quedan en el mismo dominio (la app las llama con path relativo). El SPA-fallback lo da `vercel.json` → `rewrites` (`/((?!api/).*) → /index.html`); las rutas `/api/*` quedan excluidas del rewrite.

### Conectar el repo
1. Push del repo a GitHub/GitLab.
2. Vercel dashboard → **Add New → Project → Import** el repo.
3. Build settings: framework preset **Vite** (autodetectado), **build command** `npm run build`, **output directory** `dist`. No hay deploy command.
4. **Variables de entorno** (Settings → Environment Variables):
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` → públicas (Vite las inyecta en build).
   - `GROQ_API_KEY` → solo la Function la lee en runtime (`process.env`); nunca llega al cliente.
5. Deploy. Cada push redeploya (Preview en ramas, Production en `main`).

### Comandos
```
npm run dev                 # app (Vite). NO ejecuta las Functions de /api
vercel dev                  # app + Functions /api (probar la IA local; necesita GROQ_API_KEY en .env.local)
npm run build               # tsc -b + vite build → dist/
npm run preview             # sirve el build de dist
vercel deploy               # deploy por CLI (alternativa al git import)
```

Para `vercel dev` con el secret local: `vercel env add GROQ_API_KEY` (remoto) o un `.env.local` con `GROQ_API_KEY=...` (local, no commitear).

## Servidor MCP (`/mcp`)

`mcp/server.mjs` (ESM plano, sin build) expone las tareas como herramientas MCP por stdio para
Claude Code/Desktop. Cada persona lo corre con su login de la app (`THREAD_EMAIL`/`THREAD_PASSWORD`
en `.env.local`); usa `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` de `.env` y la misma RLS que la web.
`.mcp.json` en la raíz lo registra a nivel proyecto (Claude Code lo ofrece al abrir el repo).
Tools: `mis_tareas`, `listar_tareas`, `ver_tarea`, `crear_tarea`, `empezar_tarea`, `completar_tarea`,
`enviar_a_revision`, `revisiones_pendientes`, `aprobar_tarea`, `devolver_tarea`, `comentar_tarea`,
`asignar_tarea`, `listar_proyectos`, `equipo`. Genera las mismas notificaciones in-app que la web
(tipo `revision` para transiciones de revisión). Setup y ejemplos: `mcp/README.md`.
Correr a mano: `npm run mcp`. Smoke test: es stdio JSON-RPC (initialize → tools/list).

## Navegación base

Sidebar en dos grupos (`src/components/Layout.tsx`):
- **Siempre visible** (el día a día es tareas): Hoy · Mis tareas · Para mí · Revisiones.
- **Bajo «Más»**, colapsado por defecto (armado del proyecto, se usa fuerte al principio): Proyectos · Reuniones · Calendario · Equipo. Estado en `localStorage.nav_mas`; se despliega solo si la ruta activa cae ahí o si corre el onboarding (para que el ítem activo y los targets del tour nunca queden invisibles).

`/` redirige a `/hoy`.

**Volver al origen** (`src/lib/navegacion.ts`): una tarea siempre se abre dentro de su proyecto (`/proyectos/:id?tarea=…`) pero se llega desde muchas vistas. `rutaTarea(proyectoId, tareaId, de)` agrega `&de=<ruta>`; `ProyectoDetalle` lo lee y con eso el botón de volver muestra la vista de origen ("Mis tareas", "Hoy", …) y cerrar el panel (X o Esc) devuelve ahí en vez de tirar a `/proyectos`. Sin `de` el comportamiento es el de antes. `origenValido` rechaza cualquier cosa que no sea una ruta interna; `volverDesde(pathname)` es el helper para los saltos flotantes (campana, ⌘K).

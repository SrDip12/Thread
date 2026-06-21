# Thread

App web de gestión de proyectos/tareas. UI **en español**.

## Stack

- **React 19** + **TypeScript** (modo estricto)
- **Vite 6** (dev server y build)
- **Tailwind CSS v4** vía `@tailwindcss/vite` (sin `tailwind.config.js`; tokens en `src/index.css` con `@theme`)
- **React Router v7** (`react-router-dom`, modo declarativo)
- **@tanstack/react-query** (estado de servidor / cache)
- **@supabase/supabase-js** (backend: datos + auth)
- Deploy: **Cloudflare Pages** (+ Pages Functions en `/functions`)

## Estructura

```
/design            Export de Claude Design. REFERENCIA VISUAL. NO MODIFICAR.
/functions         Cloudflare Pages Functions (vacío por ahora; cada .ts = ruta /api).
/public            Estáticos. _redirects hace el fallback SPA.
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

`personas` · `proyectos` · `modulos`(→proyecto) · `sprints`(→proyecto) · `reuniones`(→proyecto, →sprint?) · `tareas`(→modulo, →persona?, →sprint?, →reunion?) · `comentarios`(→tarea, →persona) · `pulsos`(→sprint, →persona) · `reunion_asistentes`(→reunion, →persona, PK compuesta).

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
- Colores dinámicos (acento por proyecto, estados de tarea) → inline desde `src/lib/ui.ts` (`estadoVM`, `iniciales`, `fmtFecha`).
- Presentacionales reutilizables → `src/components/ui.tsx` (`Avatar`, `AvatarStack`, `EstadoChip`, `ProgressBar`, `Eyebrow`).
- Pantallas en `src/pages/`: `Proyectos`, `ProyectoDetalle` (módulos = secciones, filas densas, panel lateral `TareaPanel`), `MisTareas`, `ParaMi`, `Equipo`. `Reuniones` sigue como placeholder.

## Sprints (liviano)

Ventana de tiempo **ortogonal a los módulos**: la tarea sigue en su módulo y gana `sprint_id` opcional; el backlog = tareas sin sprint. Sin story points / velocity / burndown. Datos en `src/data/sprints.ts` + `src/data/pulsos.ts`; UI en `src/pages/Sprint.tsx` (ruta `/proyectos/:id/sprint`, link desde el detalle de proyecto). Incluye: crear sprint rápido ("Sprint N", fechas hoy..+14, objetivo de una línea), vista del sprint activo (tareas de todos los módulos, chip de estado que cicla), quick-add al sprint, mover backlog↔sprint, **pulso async** (reemplaza el daily; una línea por persona) y **cierre** (3 campos: logros/pegados/cambio; al cerrar, las no terminadas vuelven al backlog).

## Reuniones + extracción con IA

Registra reuniones (no las agenda) y convierte notas en tareas. Datos `src/data/reuniones.ts`; UI `src/pages/Reuniones.tsx` (`/reuniones`, filtrable por proyecto) y `src/pages/ReunionDetalle.tsx` (`/reuniones/:id`: encabezado proyecto/tipo/fecha/sprint/asistentes, notas con autoguardado, extracción IA, tareas creadas).

**Extracción IA** → `functions/extraer-tareas.ts` (Cloudflare Pages Function, `POST /extraer-tareas`):
- Proveedor: **Groq** (API compatible con OpenAI, `POST /openai/v1/chat/completions`). Modelo en la constante `MODEL = 'llama-3.3-70b-versatile'` (cambiar ahí). Usa `response_format: json_object`.
- API key: **secret de Cloudflare Pages** `GROQ_API_KEY` (`env.GROQ_API_KEY`, header `Authorization: Bearer`), nunca en el cliente. Setear: dashboard → Settings → Environment variables (Secret), o `npx wrangler pages secret put GROQ_API_KEY`.
- Recibe `{ notas, personas[], modulos[] }`, devuelve `{ tareas: [{ titulo, responsable_sugerido, modulo_sugerido, fecha }] }` (validado/tipado). Cliente: `src/lib/extraer.ts`.
- Las tareas **nunca** se crean sin revisión: el detalle muestra una vista editable (responsable/módulo/fecha) antes de confirmar; al confirmar se crean con `reunion_id` + `sprint_id`.
- **Dev local**: `vite dev` NO ejecuta Functions. Para probar la IA local: `npx wrangler pages dev` (sirve `/functions`) con `GROQ_API_KEY` seteado, o probá contra el deploy.

## Realtime

Cambios en `tareas` y `comentarios` se reflejan en vivo entre miembros. Hook `src/data/realtime.ts` → `useRealtimeProyecto(proyectoId, moduloIds)`: se suscribe a `postgres_changes` e **invalida** las queries de TanStack (`qk.tareas.all` / `qk.comentarios.all`), que solo refetchean las vistas montadas. Montado en `ProyectoDetalle` y `Sprint`, así la suscripción vive solo con el proyecto abierto. Filtra tareas por `modulo_id` del proyecto en el cliente (Realtime solo filtra por una columna en server).

Requiere la migración `…_realtime.sql` (agrega las tablas a la publicación `supabase_realtime` + `replica identity full`). Aplicar en el SQL editor o `supabase db push`.

## Deploy (Cloudflare Pages)

Build de Vite: **build command** `npm run build`, **output dir** `dist` (también en `wrangler.toml` → `pages_build_output_dir`). Node 20 (`.node-version`). Las **Pages Functions** de `/functions` se despliegan automáticamente junto al sitio; `POST /extraer-tareas` queda accesible en el mismo dominio (la app la llama con path relativo). El SPA-fallback lo da `public/_redirects` (`/* /index.html 200`); las Functions tienen prioridad sobre ese fallback.

### Conectar el repo
1. Push del repo a GitHub/GitLab.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**, elegí el repo.
3. Build settings: framework preset **Vite** (o None), **build command** `npm run build`, **output directory** `dist`.
4. **Variables de entorno** (Settings → Environment variables):
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` → **plain** (públicas; Vite las inyecta en build, por eso van como variables, no secrets).
   - `GROQ_API_KEY` → **Secret/Encrypted** (solo la Function la lee en runtime; nunca llega al cliente).
   - `NODE_VERSION` = `20` si el preset no toma `.node-version`.
5. Deploy. Cada push redeploya.

### Comandos
```
npm run dev                 # app (Vite). NO ejecuta las Functions de /functions
npx wrangler pages dev      # app + Functions /functions (probar /extraer-tareas local; necesita GROQ_API_KEY)
npm run build               # tsc -b + vite build → dist/
npm run preview             # sirve el build de dist
npx wrangler pages deploy   # deploy por CLI (alternativa al git connect)
```

Para `wrangler pages dev` con el secret local: `npx wrangler pages secret put GROQ_API_KEY` (remoto) o un `.dev.vars` con `GROQ_API_KEY=...` (local, no commitear).

## Navegación base

Sidebar: Proyectos · Mis tareas · Para mí · Reuniones · Equipo. `/` redirige a `/proyectos`.

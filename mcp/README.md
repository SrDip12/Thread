# Thread MCP

Servidor MCP (stdio) que expone las tareas de Thread como herramientas para Claude
(Claude Code, Claude Desktop, o cualquier cliente MCP). Cada persona del equipo lo
corre con **su** login de la app: mismas credenciales, misma RLS.

## Setup (una vez por persona)

1. En la raíz del repo, `npm install` (instala `@modelcontextprotocol/sdk`). Si Claude Code
   muestra `thread: Connection closed`, casi siempre es que falta este paso.
2. Verificá que exista `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (los mismos de la app).
3. Creá `.env.local` (no se commitea) con tu login de Thread:

   ```
   THREAD_EMAIL=vos@equipo.com
   THREAD_PASSWORD=tu-password
   ```

4. **Claude Code**: el repo ya trae `.mcp.json`, así que al abrir el proyecto se ofrece
   el servidor `thread` automáticamente. Nada más que hacer.

   **Claude Desktop**: agregá a la config de MCP:

   ```json
   {
     "mcpServers": {
       "thread": {
         "command": "node",
         "args": ["C:/ruta/al/repo/mcp/server.mjs"]
       }
     }
   }
   ```

## Usarlo desde el repo de cada proyecto

Para que Claude Code trabaje un proyecto (otro repo) contra Thread:

1. En ese repo, un `.mcp.json` que apunte a este servidor con ruta absoluta:

   ```json
   { "mcpServers": { "thread": { "command": "node", "args": ["C:/ruta/a/Thread/mcp/server.mjs"] } } }
   ```

   (Lee `.env` / `.env.local` de la raíz de Thread, no del repo del proyecto.)
2. Copiá [`CLAUDE.proyecto.md`](./CLAUDE.proyecto.md) como `CLAUDE.md` (o sumalo al existente)
   y reemplazá `<NOMBRE DEL PROYECTO>`.
3. En Thread, cargá el **repo** del proyecto (Definición → Repositorio) y configurá el
   webhook de GitHub (ver `CLAUDE.md` de Thread → GitHub).

## Herramientas

| Tool | Qué hace |
|---|---|
| `siguiente_tarea` | La próxima tarea tuya: en curso primero, luego prioridad y vencimiento; saltea las bloqueadas |
| `contexto_proyecto` | Definición de producto, repo, módulos con avance, decisiones recientes, correcciones abiertas |
| `mis_tareas` | Tus tareas (pendientes / hechas / todas), ordenadas por prioridad y vencimiento |
| `listar_tareas` | Tareas con filtros: proyecto, estado, responsable, vencidas |
| `ver_tarea` | Detalle + comentarios (acepta id o título parcial) |
| `crear_tarea` | Nueva tarea en proyecto/módulo, con responsable, fecha, criterio y prioridad |
| `crear_modulo` | Nuevo módulo (área funcional) en un proyecto |
| `priorizar_tarea` | Cambia la prioridad (alta / media / baja) |
| `empezar_tarea` | Pasa a **en curso** |
| `registrar_avance` | Comenta qué se hizo; opcional: vincula el PR y/o manda a revisión |
| `completar_tarea` | Pasa a **hecha** (si estaba en revisión, solo el responsable de visión / un PO) |
| `enviar_a_revision` | Pasa a **revisión** (avisa al responsable de visión) |
| `revisiones_pendientes` | Bandeja de tareas esperando revisión |
| `aprobar_tarea` | Revisión → hecha (solo responsable de visión / PO) |
| `devolver_tarea` | Revisión → en curso con motivo (queda como comentario) |
| `comentar_tarea` | Comenta una tarea |
| `asignar_tarea` | Asigna/reasigna responsable (`"yo"` para autoasignarte) |
| `registrar_decision` | Guarda una decisión en el registro del proyecto |
| `cartera` | Salud de todos los proyectos activos, lo más en riesgo primero |
| `listar_proyectos` / `equipo` | Contexto: proyectos con módulos, personas con rol |

Las tareas se referencian por **título parcial** o id; si el título es ambiguo el
servidor lista las coincidencias con sus ids.

Ejemplos: *"¿qué sigo?"*, *"dame el contexto de Flujo"*, *"marcá 'diseñar login' como hecha"*,
*"registrá el avance: login listo, falta recuperar contraseña, PR https://…"*,
*"¿cómo está la cartera?"*.

## Notificaciones

Las notificaciones in-app (asignación, comentario, mención, envío a revisión, aprobación,
devolución) las generan **triggers en la base**, igual para la web, el MCP y el webhook de
GitHub. El MCP no inserta notificaciones a mano.

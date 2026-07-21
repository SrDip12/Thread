# Thread MCP

Servidor MCP (stdio) que expone las tareas de Thread como herramientas para Claude
(Claude Code, Claude Desktop, o cualquier cliente MCP). Cada persona del equipo lo
corre con **su** login de la app: mismas credenciales, misma RLS.

## Setup (una vez por persona)

1. En la raíz del repo, `npm install` (ya instala `@modelcontextprotocol/sdk`).
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

## Herramientas

| Tool | Qué hace |
|---|---|
| `mis_tareas` | Tus tareas (pendientes / hechas / todas), ordenadas por vencimiento |
| `listar_tareas` | Tareas con filtros: proyecto, estado, responsable, vencidas |
| `ver_tarea` | Detalle + comentarios (acepta id o título parcial) |
| `crear_tarea` | Nueva tarea en proyecto/módulo, con responsable y fecha |
| `empezar_tarea` | Pasa a **en curso** |
| `completar_tarea` | Pasa a **hecha** |
| `enviar_a_revision` | Pasa a **revisión** y avisa al responsable de visión |
| `revisiones_pendientes` | Bandeja de tareas esperando revisión |
| `aprobar_tarea` | Revisión → hecha, avisa al responsable |
| `devolver_tarea` | Revisión → en curso con motivo (comentario + aviso) |
| `comentar_tarea` | Comenta una tarea (avisa al responsable) |
| `asignar_tarea` | Asigna/reasigna responsable (`"yo"` para autoasignarte) |
| `listar_proyectos` / `equipo` | Contexto: proyectos con módulos, personas con rol |

Las tareas se referencian por **título parcial** o id; si el título es ambiguo el
servidor lista las coincidencias con sus ids.

Ejemplos de uso en Claude: *"¿qué tengo para hoy?"*, *"marcá 'diseñar login' como hecha"*,
*"mandá la tarea del navbar a revisión"*, *"devolvé 'API de pagos' porque falta manejo de errores"*.

## Notificaciones

Las acciones del MCP generan las mismas notificaciones in-app que la web: asignación,
comentario, envío a revisión (al responsable de visión) y aprobación/devolución (al responsable).

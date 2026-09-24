# Pendientes para salir a producción

Lo que quedó fuera del código tras la auditoría (2026-09-23). Todo el código está listo
en el working tree, **sin commit**. Seguir en este orden.

## 0. Revisar y commitear

- [ ] Revisar el diff (`git status` / `git diff`) y commitear.
- [ ] Push → CI corre typecheck + tests + build.

## 1. Base de datos (antes o junto con el deploy)

El código nuevo depende de estas migraciones.

- [ ] `supabase link --project-ref <ref-de-thread>` (si no está linkeado)
- [ ] `supabase db push` → aplica:
  - `20260923000000_seguridad_avisos.sql` (RLS de notificaciones/mensajes/dependencias, triggers de avisos, vencimientos)
  - `20260923010000_cartera_prioridad_github.sql` (prioridad, repo/PR, decisiones, vista de cartera, permisos por proyecto)
- [ ] `supabase db advisors` sin warnings de seguridad/RLS
- [ ] Opcional: `supabase gen types typescript --linked > src/lib/database.types.ts` (hoy están escritos a mano y ya incluyen lo nuevo)
- [ ] Verificar que cada persona activa tenga `user_id` (o email igual al de su cuenta)

## 2. Supabase Dashboard

- [ ] Authentication → desactivar **signups públicos** (`config.toml` solo afecta local)
- [ ] Cuentas nuevas: Authentication → **Invite user** + alta en Equipo con el mismo email

## 3. Variables de entorno en Vercel

Settings → Environment Variables (detalle en `.env.example`). Ninguna con prefijo `VITE_`.

- [ ] `SUPABASE_SERVICE_ROLE_KEY` — cron y webhook (Supabase → Settings → API)
- [ ] `CRON_SECRET` — cualquier string largo aleatorio
- [ ] `RESEND_API_KEY` — sin esta, los correos solo se simulan en el log
- [ ] `RESEND_FROM` — ej. `Thread <avisos@tu-dominio.com>` (dominio verificado en Resend)
- [ ] `GITHUB_WEBHOOK_SECRET` — cualquier string largo aleatorio
- [ ] `APP_URL` — URL pública de la app (links de los correos)
- [ ] Confirmar que siguen `GROQ_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Redeploy

## 4. Probar en producción

- [ ] Login → vista **Cartera** carga sin error
- [ ] Asignar una tarea a otro → le llega la notificación
- [ ] Un dev que no es responsable de visión **no** puede aprobar una tarea en revisión
- [ ] Extraer tareas de una reunión (IA) funciona logueado
- [ ] `curl -X POST https://<app>/api/extraer-tareas` sin sesión → **401**
- [ ] Cron: Vercel → Settings → Cron Jobs → ejecutar `/api/digest` a mano → llega el correo

## 5. GitHub (por cada repo de proyecto)

- [ ] En Thread: proyecto → Definición → **Repositorio** = URL del repo
- [ ] En GitHub: repo → Settings → Webhooks → Add webhook
  - Payload URL: `https://<app>/api/github`
  - Content type: `application/json`
  - Secret: el mismo `GITHUB_WEBHOOK_SECRET`
  - Evento: solo **Pull requests**
- [ ] Probar: PR con `Thread-Tarea: <id>` en la descripción → la tarea pasa a revisión; merge → hecha

## 6. MCP para cada socio

- [ ] `npm install` en el repo de Thread (sin esto: `thread: Connection closed`)
- [ ] `.env` con `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- [ ] `.env.local` con `THREAD_EMAIL` / `THREAD_PASSWORD` propios
- [ ] En cada repo de proyecto: `.mcp.json` apuntando a `mcp/server.mjs` (ruta absoluta) y
      copiar `mcp/CLAUDE.proyecto.md` a su `CLAUDE.md` (reemplazar `<NOMBRE DEL PROYECTO>`)

## 7. Ordenar los proyectos (una vez)

- [ ] Asignar **responsable de visión** a cada proyecto (define quién aprueba)
- [ ] Marcar prioridad **alta** en lo urgente de cada proyecto
- [ ] Pausar/cerrar proyectos que ya no se mueven, para que la Cartera muestre solo lo vivo

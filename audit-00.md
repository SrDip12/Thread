# Audit 00 — Production readiness de Thread

Fecha: 2026-06-21 · Alcance: calidad, integración y seguridad para salir a producción
(**omitiendo** el deploy en Cloudflare, ya documentado en `CLAUDE.md`).

Leyenda: ✅ resuelto en este cambio · ⚠️ parcial · ⬜ pendiente (recomendación).

---

## 🔴 Crítico

### ✅ 1. El schema de la DB estaba fuera de git
`.gitignore` tenía `*.sql`, que ignoraba **todas** las migraciones (`supabase/migrations/*.sql`)
y `supabase/seed.sql`. `git ls-files supabase/` solo listaba `config.toml`: un clon limpio o un
pipeline de CI **no podía recrear la base**. Verificado con `git check-ignore`.

**Hecho:** se quitó `*.sql` del `.gitignore` (reemplazado por `supabase/.temp/` + `vite.dev.log`),
se versionaron las 7 migraciones reales y el seed, se borró la migración muerta de 0 bytes
(`20260619035926_grants.sql`) y se destrackeó `vite.dev.log` y `supabase/.temp/cli-latest`.

### ✅ 2. RLS permisivo (cualquier autenticado lee/escribe todo)
Las 11 tablas tenían una sola política `auth_all_*` → `for all to authenticated using(true)`.
El propio `CLAUDE.md` lo marcaba como "no para producción".

**Hecho:** migración `20260621000000_rls_equipo.sql`, modelo **equipo único**:
- `personas.user_id uuid references auth.users` + índice único + backfill por email.
- Helpers `es_miembro()` / `es_po()` (`SECURITY DEFINER STABLE`, chequean `auth.uid()` **o** email
  → sin recursión y sin huevo-y-gallina al linkear).
- Políticas por operación: toda persona activa lee/escribe las tablas generales; **PO-only** para
  gestionar `personas` y para borrar `proyectos`. `anon` sin acceso.

> Pendiente al aplicar: correr `supabase db push` (o `db reset`), validar con `supabase db advisors`
> y **regenerar** `src/lib/database.types.ts` (la nueva columna `personas.user_id`).

---

## 🟠 Alto

### ⬜ 3. Sin tests y sin CI
No hay runner (Vitest/Jest) ni workflow de GitHub Actions. Nada corre `typecheck`/`build`
automáticamente en cada push. Mínimo recomendado: un workflow que ejecute `npm ci && npm run build`,
y tests de las funciones puras de mayor riesgo (`functions/extraer-tareas.ts` parsers,
`src/lib/ui.ts`).

### ⬜ 4. Errores de Supabase silenciados
Varias lecturas descartan `error`. Ej. `buscarPersona` en `src/auth/AuthProvider.tsx` ignora el
error de la query; si falla la red, el usuario cae en "tu email no está registrado" sin señal real.
Revisar hooks de `src/data/*` para propagar `error` a la UI (React Query ya lo expone).

### ⬜ 5. Signup público abierto
`src/components/Login.tsx` ofrece "Crear cuenta" a cualquiera; tras registrarse el usuario cae en
"email no registrado". Para producción, **desactivar signups públicos** en Supabase Auth
(Dashboard → Authentication → Providers/Settings) y/o quitar el botón. El alta de personas la hace
un PO.

---

## 🟡 Medio

### ✅ 6. Sin ErrorBoundary (riesgo de pantalla en blanco)
Cualquier throw en render tiraba toda la app. **Hecho:** `src/components/ErrorBoundary.tsx`
(única clase permitida; React lo exige) envolviendo `<App/>` en `src/main.tsx`, con fallback en
español y botón "Recargar".

### ⬜ 7. `index.html` sin metadatos
Falta `meta description`, favicon y `theme-color`. (`lang="es"` y viewport ya están.)

### ⬜ 8. `QueryClient` sin tuning
`new QueryClient()` con defaults. Considerar `staleTime` y política de `retry` acorde a
optimistic updates ya presentes en `src/data/*`.

### ⬜ 9. No hay vista 404 real
La ruta `*` redirige a `/proyectos`. Aceptable, pero una página "no encontrado" es más clara.

### ⬜ 10. Bundle único de ~612 kB (168 kB gzip)
`vite build` avisa de chunk > 500 kB. No bloquea, pero conviene code-splitting por ruta
(`React.lazy` + `Suspense`) si crece.

---

## ✨ Onboarding (entregado)
Tour guiado interactivo en `src/components/Onboarding.tsx`: spotlight sobre las secciones del
sidebar, auto-abre en el primer login (`localStorage['thread_onboarding_visto']`) y se reabre con el
botón **"?"** del menú. Wireado en `src/components/Layout.tsx`.

---

## ✅ Checklist go-live (sin Cloudflare)
- [ ] `supabase db push` con la migración RLS aplicada al entorno remoto.
- [ ] `supabase db advisors` sin warnings de seguridad/RLS.
- [ ] `supabase gen types typescript --linked > src/lib/database.types.ts` (incluye `user_id`).
- [ ] Verificar que cada `personas` activa tenga su `user_id` backfilleado (o email coincidente).
- [ ] Smoke test de roles: `dev` no borra proyectos ni edita `personas`; `po` sí; `anon` ve cero filas.
- [ ] `npm run build` verde (ya verificado en este cambio).
- [ ] Desactivar signups públicos en Supabase Auth.
- [ ] (Reco) Agregar CI mínimo: `npm ci && npm run build` en cada push.

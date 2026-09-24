// Infra compartida de las Functions de /api (los archivos con "_" no son rutas en Vercel).
// - autenticar(): valida el JWT de Supabase que manda la app y que el usuario sea
//   una persona activa del equipo. Sin esto, cualquiera en internet podía gastar la
//   cuota de Groq o mandar correos desde nuestro dominio.
// - clienteServicio(): cliente service_role para cron y webhooks (sin usuario).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types'

export type Cliente = SupabaseClient<Database>

export function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function urlYAnon() {
  return {
    url: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    anon: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
  }
}

export interface Sesion {
  supabase: Cliente
  personaId: string
}

export async function autenticar(request: Request): Promise<Sesion | Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'No autenticado.' }, 401)

  const { url, anon } = urlYAnon()
  if (!url || !anon) {
    return json({ error: 'Falta configurar VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el servidor.' }, 500)
  }

  // Cliente con el token del usuario: todas las lecturas pasan por su RLS.
  const supabase = createClient<Database>(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: usuario, error } = await supabase.auth.getUser(token)
  const email = usuario.user?.email
  if (error || !email) return json({ error: 'Sesión inválida.' }, 401)

  const { data: persona, error: errPersona } = await supabase
    .from('personas')
    .select('id')
    .eq('email', email)
    .eq('activo', true)
    .maybeSingle()
  if (errPersona) return json({ error: 'No se pudo verificar la membresía.' }, 500)
  if (!persona) return json({ error: 'Tu usuario no es miembro activo del equipo.' }, 403)

  return { supabase, personaId: persona.id }
}

export function clienteServicio(): Cliente | null {
  const { url } = urlYAnon()
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !clave) return null
  return createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Comparación en tiempo constante (secretos de cron/webhook).
export function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

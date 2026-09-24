// POST a las Functions de /api con el token de la sesión de Supabase: los endpoints
// rechazan (401/403) cualquier llamada que no venga de un miembro autenticado.

import { supabase } from './supabase.ts'

export async function postApi(ruta: string, cuerpo: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return fetch(ruta, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(cuerpo),
  })
}

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // ponytail: aviso temprano en dev; en prod las env vars vienen de Cloudflare Pages.
  console.warn('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY (ver .env.example)')
}

export const supabase = createClient<Database>(url ?? '', anonKey ?? '')

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'
import type { Tables } from '../lib/database.types.ts'

type Persona = Tables<'personas'>

interface AuthContextValue {
  session: Session | null
  persona: Persona | null
  cargando: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function buscarPersona(email: string | undefined): Promise<Persona | null> {
  if (!email) return null
  const { data } = await supabase
    .from('personas')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [persona, setPersona] = useState<Persona | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true

    async function resolverSesion(nuevaSesion: Session | null) {
      const nuevaPersona = await buscarPersona(nuevaSesion?.user.email)
      if (!activo) return
      setSession(nuevaSesion)
      setPersona(nuevaPersona)
      setCargando(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      void resolverSesion(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setCargando(true)
      void resolverSesion(nuevaSesion)
    })

    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, persona, cargando, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

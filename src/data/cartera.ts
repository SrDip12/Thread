// Salud de la cartera: una fila por proyecto desde la vista `v_salud_proyectos`
// (el cálculo vive en SQL para que la web, el cron y el MCP usen el mismo número).
// Las reglas del semáforo están en src/lib/salud.ts.

import { useQuery } from '@tanstack/react-query'
import type { SaludProyecto } from '../lib/salud.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

export function useSaludProyectos() {
  return useQuery({
    queryKey: qk.cartera.salud(),
    queryFn: async (): Promise<SaludProyecto[]> => {
      const { data, error } = await supabase.from('v_salud_proyectos').select('*')
      if (error) throw error
      return data
    },
    staleTime: 60_000,
  })
}

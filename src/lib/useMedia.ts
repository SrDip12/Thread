import { useEffect, useState } from 'react'

/** Media query reactiva. Se usa para montar UNA sola instancia de componentes
 *  con suscripción Realtime (ej. Campana) según el breakpoint, en vez de
 *  duplicarlas y esconder una con CSS. */
export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatch(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return match
}

/** true por debajo del breakpoint lg de Tailwind (1024px). */
export const useEsCompacto = () => useMediaQuery('(max-width: 1023px)')

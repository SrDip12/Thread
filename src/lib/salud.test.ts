import { describe, expect, it } from 'vitest'
import { DIAS_ESTANCADO, diasDesde, semaforo, type SaludProyecto } from './salud.ts'

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

const base: SaludProyecto = {
  proyecto_id: 'p',
  total: 10,
  hechas: 4,
  vencidas: 0,
  en_revision: 0,
  en_curso: 2,
  sin_asignar: 0,
  correcciones: 0,
  alta_abiertas: 0,
  ultima_actividad: hace(1),
}

describe('semaforo', () => {
  it('verde si fluye', () => {
    expect(semaforo(base)).toBe('verde')
  })
  it('rojo si hay vencidas', () => {
    expect(semaforo({ ...base, vencidas: 1 })).toBe('rojo')
  })
  it(`rojo si lleva ${DIAS_ESTANCADO}+ días sin actividad`, () => {
    expect(semaforo({ ...base, ultima_actividad: hace(DIAS_ESTANCADO) })).toBe('rojo')
  })
  it('ámbar si hay trabajo sin dueño o cuello en revisión', () => {
    expect(semaforo({ ...base, sin_asignar: 2 })).toBe('ambar')
    expect(semaforo({ ...base, en_revision: 3 })).toBe('ambar')
  })
})

describe('diasDesde', () => {
  it('null sin fecha, días completos con fecha', () => {
    expect(diasDesde(null)).toBeNull()
    expect(diasDesde(hace(3))).toBe(3)
  })
})

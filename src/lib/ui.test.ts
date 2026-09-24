import { describe, expect, it } from 'vitest'
import { compararFoco, diasHasta, fechaVM } from './ui.ts'

const hoyMas = (dias: number) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('compararFoco', () => {
  it('ordena por prioridad antes que por fecha', () => {
    const tareas = [
      { id: 'baja-pronto', prioridad: 'baja' as const, fecha: hoyMas(0) },
      { id: 'alta-lejos', prioridad: 'alta' as const, fecha: hoyMas(30) },
      { id: 'media-sin', prioridad: 'media' as const, fecha: null },
      { id: 'media-pronto', prioridad: 'media' as const, fecha: hoyMas(1) },
    ]
    expect([...tareas].sort(compararFoco).map((t) => t.id)).toEqual([
      'alta-lejos',
      'media-pronto',
      'media-sin',
      'baja-pronto',
    ])
  })

  it('con igual prioridad, sin fecha va al final', () => {
    const a = { prioridad: 'media' as const, fecha: null }
    const b = { prioridad: 'media' as const, fecha: hoyMas(5) }
    expect(compararFoco(a, b)).toBeGreaterThan(0)
    expect(compararFoco(b, a)).toBeLessThan(0)
  })
})

describe('diasHasta / fechaVM', () => {
  it('cuenta días de calendario', () => {
    expect(diasHasta(hoyMas(0))).toBe(0)
    expect(diasHasta(hoyMas(-3))).toBe(-3)
    expect(diasHasta(hoyMas(2))).toBe(2)
  })

  it('marca vencida solo si no está hecha', () => {
    expect(fechaVM(hoyMas(-1))?.vencida).toBe(true)
    expect(fechaVM(hoyMas(-1), true)?.vencida).toBe(false)
    expect(fechaVM(null)).toBeNull()
  })
})

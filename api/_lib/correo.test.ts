import { describe, expect, it } from 'vitest'
import { esc, mencionados, renderCorreo } from './correo'

describe('esc', () => {
  it('neutraliza HTML', () => {
    expect(esc('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(esc(null)).toBe('')
  })
})

describe('renderCorreo', () => {
  it('no deja pasar HTML de los textos del usuario', () => {
    const html = renderCorreo({
      acento: '#c96442',
      badge: 'Mención',
      badgeFondo: '#fff',
      saludo: 'Hola **Ana**,',
      intro: '**<img src=x onerror=alert(1)>** te mencionó',
      bloques: [{ etiqueta: 'Comentario', texto: '<a href="https://phish.example">clic</a>' }],
      boton: { label: 'Ver', url: 'https://thread.app/x?a=1&b="2"' },
      pie: 'pie',
    })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<a href="https://phish.example"')
    expect(html).toContain('<strong>Ana</strong>')
    expect(html).toContain('href="https://thread.app/x?a=1&amp;b=&quot;2&quot;"')
  })
})

describe('mencionados', () => {
  const equipo = [
    { id: '1', nombre: 'Ana Ruiz' },
    { id: '2', nombre: 'Beto' },
  ]
  it('detecta @nombre con y sin espacios, sin distinguir mayúsculas', () => {
    expect(mencionados('hola @AnaRuiz', equipo).map((p) => p.id)).toEqual(['1'])
    expect(mencionados('cc @ana ruiz y @BETO', equipo).map((p) => p.id)).toEqual(['1', '2'])
    expect(mencionados('sin menciones', equipo)).toEqual([])
  })
})

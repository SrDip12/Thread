// Plantilla y envío de correos (Resend). Todo valor interpolado pasa por `esc`:
// los textos vienen de usuarios (títulos, comentarios) y no pueden inyectar HTML.

export function esc(valor: string | null | undefined): string {
  return (valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface Bloque {
  etiqueta: string
  texto: string
  cursiva?: boolean
}

export interface PlantillaCorreo {
  acento: string
  badge: string
  badgeFondo: string
  saludo: string
  /** Texto introductorio; `**x**` se muestra en negrita (se escapa antes). */
  intro: string
  bloques: Bloque[]
  /** HTML ya armado con `esc` (listas del resumen). Opcional. */
  htmlExtra?: string
  boton: { label: string; url: string }
  pie: string
}

const negritas = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

export function renderCorreo(p: PlantillaCorreo): string {
  const bloques = p.bloques
    .map(
      (b, i) => `
      ${i > 0 ? '<div style="border-top:1px dashed #e2e8f0;margin:12px 0;"></div>' : ''}
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;margin-bottom:6px;">${esc(b.etiqueta)}</div>
      <div style="font-size:14px;line-height:1.6;color:#1e293b;white-space:pre-wrap;${b.cursiva ? 'font-style:italic;' : ''}">${esc(b.texto)}</div>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
<tr><td style="background:${p.acento};height:6px;padding:0;"></td></tr>
<tr><td style="padding:36px 32px;">
  <div style="margin-bottom:22px;">
    <span style="font-size:20px;font-weight:800;color:#1e293b;">Thread</span>
    <span style="font-size:12px;font-weight:600;color:${p.acento};background:${p.badgeFondo};padding:4px 8px;border-radius:6px;margin-left:8px;">${esc(p.badge)}</span>
  </div>
  <p style="font-size:15px;color:#334155;margin:0 0 14px 0;">${negritas(p.saludo)}</p>
  <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 22px 0;">${negritas(p.intro)}</p>
  ${bloques ? `<div style="background:#f8fafc;border:1px solid #f1f5f9;border-radius:12px;padding:20px 24px;margin-bottom:28px;">${bloques}</div>` : ''}
  ${p.htmlExtra ?? ''}
  <div style="text-align:center;">
    <a href="${esc(p.boton.url)}" style="display:inline-block;background:${p.acento};color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px;">${esc(p.boton.label)}</a>
  </div>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:20px 32px;text-align:center;">
  <p style="font-size:12px;color:#94a3b8;margin:0;">${esc(p.pie)}</p>
</td></tr>
</table></td></tr></table>
</body></html>`
}

export interface Envio {
  para: string
  asunto: string
  html: string
}

// Envía por Resend. Sin RESEND_API_KEY, simula (log) y devuelve ok.
export async function enviarCorreo(envio: Envio): Promise<{ ok: boolean; simulado: boolean }> {
  const clave = process.env.RESEND_API_KEY
  if (!clave) {
    console.log(`[correo simulado] Para: ${envio.para} · Asunto: ${envio.asunto}`)
    return { ok: true, simulado: true }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${clave}` },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Thread <onboarding@resend.dev>',
      to: [envio.para],
      subject: envio.asunto,
      html: envio.html,
    }),
  })
  if (!res.ok) console.error('Resend respondió', res.status, await res.text())
  return { ok: res.ok, simulado: false }
}

// Menciones @nombre (con o sin espacios). Misma regla que la función SQL
// `personas_mencionadas`.
export function mencionados<T extends { id: string; nombre: string }>(texto: string, personas: T[]): T[] {
  const bajo = texto.toLowerCase()
  return personas.filter((p) => {
    const n = p.nombre.toLowerCase()
    return bajo.includes(`@${n.replace(/\s+/g, '')}`) || bajo.includes(`@${n}`)
  })
}

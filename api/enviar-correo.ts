// Vercel Edge Function: POST /api/enviar-correo
// Recibe los datos de una pregunta, respuesta o mención y envía una notificación por correo.
// Si no hay RESEND_API_KEY configurada, realiza una simulación en la consola.

export const config = { runtime: 'edge' }

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface CuerpoCorreo {
  tipo: 'pregunta' | 'respuesta' | 'mencion'
  destinatarioEmail: string
  destinatarioNombre: string
  autorNombre: string
  proyectoNombre: string
  proyectoId: string
  tareaTitulo: string
  tareaId: string
  comentarioTexto: string
  preguntaTexto?: string // Requerido para respuestas
  appUrl: string
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405)
  }

  let cuerpo: CuerpoCorreo
  try {
    cuerpo = (await request.json()) as CuerpoCorreo
  } catch {
    return json({ error: 'El cuerpo de la solicitud debe ser JSON válido.' }, 400)
  }

  const {
    tipo = 'pregunta',
    destinatarioEmail,
    destinatarioNombre,
    autorNombre,
    proyectoNombre,
    proyectoId,
    tareaTitulo,
    tareaId,
    comentarioTexto,
    preguntaTexto,
    appUrl,
  } = cuerpo

  if (!destinatarioEmail || !destinatarioNombre || !autorNombre || !tareaTitulo || !comentarioTexto) {
    return json({ error: 'Faltan campos requeridos para enviar el correo.' }, 400)
  }

  const taskUrl = `${appUrl}/proyectos/${proyectoId}?tarea=${tareaId}`

  let emailHtml = ''
  let subject = ''
  let accentColor = '#c96442' // Default PO orange
  let badgeLabel = 'Pregunta PO'
  let badgeBg = '#fdf2f0'
  let introText = ''
  let buttonLabel = 'Responder Pregunta'

  if (tipo === 'pregunta') {
    subject = `[Thread] Nueva pregunta de ${autorNombre} en ${proyectoNombre}`
    accentColor = '#c96442'
    badgeLabel = 'Pregunta PO'
    badgeBg = '#fdf2f0'
    introText = `<strong>${autorNombre}</strong> ha dejado una pregunta marcada para el Product Owner en el proyecto <strong>${proyectoNombre}</strong>.`
    buttonLabel = 'Responder Pregunta'
  } else if (tipo === 'respuesta') {
    subject = `[Thread] Respuesta a tu pregunta en ${proyectoNombre}`
    accentColor = '#2e9e7b'
    badgeLabel = 'Pregunta Resuelta'
    badgeBg = '#edfcf7'
    introText = `<strong>${autorNombre}</strong> ha respondido a tu pregunta en el proyecto <strong>${proyectoNombre}</strong>.`
    buttonLabel = 'Ver en Thread'
  } else if (tipo === 'mencion') {
    subject = `[Thread] Te mencionaron en la tarea "${tareaTitulo}"`
    accentColor = '#9a5cc4' // Purple accent
    badgeLabel = 'Mención'
    badgeBg = '#f7f0fc'
    introText = `<strong>${autorNombre}</strong> te ha mencionado en un comentario en el proyecto <strong>${proyectoNombre}</strong>.`
    buttonLabel = 'Ver Comentario'
  }

  if (tipo === 'pregunta' || tipo === 'mencion') {
    emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
          <tr>
            <td style="background-color: ${accentColor}; height: 6px; padding: 0;"></td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; color: #1e293b; letter-spacing: -0.025em;">Thread</span>
                    <span style="font-size: 12px; font-weight: 600; color: ${accentColor}; background-color: ${badgeBg}; padding: 4px 8px; border-radius: 6px; margin-left: 8px; vertical-align: middle;">${badgeLabel}</span>
                  </td>
                </tr>
              </table>
              <p style="font-size: 15px; line-height: 1.5; color: #334155; margin: 0 0 16px 0; font-weight: 500;">
                Hola <strong>${destinatarioNombre}</strong>,
              </p>
              <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                ${introText}
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${accentColor}; letter-spacing: 0.05em; margin-bottom: 8px;">Tarea</div>
                    <div style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 12px; line-height: 1.4;">${tareaTitulo}</div>
                    <div style="border-top: 1px dashed #e2e8f0; margin: 12px 0;"></div>
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px;">Comentario</div>
                    <div style="font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${comentarioTexto}</div>
                  </td>
                </tr>
              </table>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${taskUrl}" target="_blank" style="display: inline-block; background-color: ${accentColor}; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: background-color 0.2s ease;">
                      ${buttonLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 24px 32px; text-align: center;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">
                Recibes este correo porque eres miembro del proyecto.<br>
                Thread App · Gestión de proyectos simple y enfocada.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  } else {
    // tipo === 'respuesta'
    emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
          <tr>
            <td style="background-color: ${accentColor}; height: 6px; padding: 0;"></td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; color: #1e293b; letter-spacing: -0.025em;">Thread</span>
                    <span style="font-size: 12px; font-weight: 600; color: ${accentColor}; background-color: ${badgeBg}; padding: 4px 8px; border-radius: 6px; margin-left: 8px; vertical-align: middle;">${badgeLabel}</span>
                  </td>
                </tr>
              </table>
              <p style="font-size: 15px; line-height: 1.5; color: #334155; margin: 0 0 16px 0; font-weight: 500;">
                Hola <strong>${destinatarioNombre}</strong>,
              </p>
              <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                ${introText}
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">Tarea</div>
                    <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 12px; line-height: 1.4;">${tareaTitulo}</div>
                    
                    <div style="border-top: 1px dashed #e2e8f0; margin: 12px 0;"></div>
                    
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #c96442; letter-spacing: 0.05em; margin-bottom: 4px;">Tu pregunta original</div>
                    <div style="font-size: 13.5px; line-height: 1.5; color: #475569; font-style: italic; margin-bottom: 14px; white-space: pre-wrap;">"${preguntaTexto || ''}"</div>
                    
                    <div style="border-top: 1px dashed #e2e8f0; margin: 12px 0;"></div>
                    
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${accentColor}; letter-spacing: 0.05em; margin-bottom: 4px;">Respuesta de ${autorNombre}</div>
                    <div style="font-size: 14px; line-height: 1.6; color: #1e293b; font-weight: 500; white-space: pre-wrap;">"${comentarioTexto}"</div>
                  </td>
                </tr>
              </table>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${taskUrl}" target="_blank" style="display: inline-block; background-color: ${accentColor}; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: background-color 0.2s ease;">
                      ${buttonLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 24px 32px; text-align: center;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">
                Recibes este correo porque hiciste una pregunta al PO en esta tarea.<br>
                Thread App · Gestión de proyectos simple y enfocada.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  }

  const resendKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY

  if (!resendKey) {
    // Si no está configurada la API key, simulamos en la consola
    console.log('\n==================================================')
    console.log(`📬 [SIMULACIÓN DE ENVÍO DE EMAIL: ${tipo.toUpperCase()}]`)
    console.log(`De: Thread App <onboarding@resend.dev>`)
    console.log(`Para: ${destinatarioNombre} <${destinatarioEmail}>`)
    console.log(`Asunto: ${subject}`)
    console.log(`Tarea: "${tareaTitulo}"`)
    if (tipo === 'respuesta') {
      console.log(`Pregunta original: "${preguntaTexto}"`)
      console.log(`Respuesta: "${comentarioTexto}"`)
    } else {
      console.log(`Comentario: "${comentarioTexto}"`)
    }
    console.log(`Enlace: ${taskUrl}`)
    console.log('==================================================\n')

    return json({
      success: true,
      simulated: true,
      message: `Correo simulado con éxito (RESEND_API_KEY no configurado)`,
      data: {
        to: destinatarioEmail,
        subject,
        html: emailHtml,
      },
    })
  }

  // Si la clave existe, hacemos el envío real utilizando la API REST de Resend
  try {
    const fromEmail = process.env.RESEND_FROM || 'Thread App <onboarding@resend.dev>'
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [destinatarioEmail],
        subject,
        html: emailHtml,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error de Resend API:', errorText)
      return json({ error: 'Error del proveedor de correo al enviar el email.' }, 502)
    }

    const data = await response.json()
    return json({ success: true, message: 'Correo enviado con éxito', data })
  } catch (error) {
    console.error('Falla al enviar correo a través de Resend:', error)
    return json({ error: 'Falla interna al enviar el correo.' }, 500)
  }
}

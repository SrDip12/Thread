#!/usr/bin/env node
// Smoke test del servidor MCP para CI: lo arranca, hace el handshake y verifica
// que exponga las 14 tools esperadas. No necesita credenciales ni red — solo
// prueba que el server carga, negocia el protocolo y declara sus herramientas.
// Sale con código 0 si todo ok, 1 si algo falla.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const TOOLS_ESPERADAS = [
  'listar_proyectos',
  'equipo',
  'mis_tareas',
  'listar_tareas',
  'ver_tarea',
  'crear_tarea',
  'empezar_tarea',
  'completar_tarea',
  'enviar_a_revision',
  'revisiones_pendientes',
  'aprobar_tarea',
  'devolver_tarea',
  'comentar_tarea',
  'asignar_tarea',
]

const proc = spawn('node', ['mcp/server.mjs'], { cwd: raiz })
let buffer = ''
let terminado = false

function fin(codigo, mensaje) {
  if (terminado) return
  terminado = true
  if (mensaje) console[codigo === 0 ? 'log' : 'error'](mensaje)
  proc.kill()
  process.exit(codigo)
}

const mensajes = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'smoke-test', version: '1.0.0' },
    },
  },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
]

proc.stdout.on('data', (chunk) => {
  buffer += chunk
  let corte
  while ((corte = buffer.indexOf('\n')) !== -1) {
    const linea = buffer.slice(0, corte).trim()
    buffer = buffer.slice(corte + 1)
    if (!linea) continue
    let msg
    try {
      msg = JSON.parse(linea)
    } catch {
      continue
    }
    if (msg.id === 2) {
      const nombres = (msg.result?.tools ?? []).map((t) => t.name)
      const faltan = TOOLS_ESPERADAS.filter((t) => !nombres.includes(t))
      if (faltan.length) fin(1, `FALLÓ: faltan tools: ${faltan.join(', ')}`)
      else fin(0, `OK: ${nombres.length} tools expuestas (${nombres.join(', ')})`)
    }
  }
})

proc.on('error', (e) => fin(1, `FALLÓ al lanzar el server: ${e.message}`))
proc.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`))

for (const m of mensajes) proc.stdin.write(JSON.stringify(m) + '\n')

setTimeout(() => fin(1, 'FALLÓ: timeout esperando tools/list'), 15000)

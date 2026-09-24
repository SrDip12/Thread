# Trabajo con Thread (plantilla para el repo de cada proyecto)

> Copiá este bloque en el `CLAUDE.md` del repo del proyecto y reemplazá `<NOMBRE DEL PROYECTO>`.
> Requiere el servidor MCP `thread` configurado (ver `mcp/README.md` en el repo de Thread).

Este repo es el proyecto **<NOMBRE DEL PROYECTO>** en Thread, donde el equipo lleva las tareas.

## Antes de escribir código

1. Llamá `siguiente_tarea` con `proyecto: "<NOMBRE DEL PROYECTO>"` para saber en qué trabajar.
   Si el usuario ya te dio una tarea, usá `ver_tarea` con su título o id.
2. Llamá `contexto_proyecto` con `"<NOMBRE DEL PROYECTO>"`: la **definición de producto**
   (qué es, para quién, qué problema resuelve) y las **decisiones** registradas mandan
   sobre tus suposiciones.
3. Si la tarea no tiene **criterio de aceptación**, proponé uno y confirmalo con el usuario
   antes de implementar.
4. `empezar_tarea` al arrancar.

## Mientras trabajás

- Una tarea = una rama = un PR. En la **descripción del PR** incluí siempre
  `Thread-Tarea: <id de la tarea>`: el webhook de GitHub la pasa a revisión al abrir el PR
  y a hecha al mergear.
- Si tomás una decisión técnica o de producto que otros deberían conocer,
  `registrar_decision` (qué y por qué, una o dos frases).
- Si descubrís trabajo nuevo, `crear_tarea` en el módulo que corresponda (no lo metas en la
  tarea actual).

## Al terminar

- `registrar_avance` con un resumen corto (qué quedó, qué falta, riesgos) y el `pr_url`.
- No marques como hecha una tarea en revisión: la aprueba el responsable de visión.

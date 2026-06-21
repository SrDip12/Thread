# Extensión Cauce → Hilo — instrucciones

El Hilo base ya está construido. Estas cinco fases lo extienden para que encarne la metodología completa. Son **migraciones aditivas**: no recrean tablas ni pantallas, solo agregan. Córrelas en orden en Claude Code.

Qué agregan: definición de producto (el norte), ciclo de vida del módulo, corrección como tipo + check de intención, la compuerta interna (responsables de visión) y la compuerta externa (cliente).

---

### Fase E1 — Definición de producto

```
Extiende la app Hilo existente (migración aditiva, no recrees nada). Agrega la "definición de producto" por proyecto: es el norte contra el que se valida todo lo demás.

Migración: agrega a la tabla proyectos los campos de una definición estructurada — que_es (texto), para_quien (texto), problema (texto). Si lo prefieres más limpio, una tabla 1:1 producto_definicion ligada a proyectos.

UI: en la pantalla de proyecto agrega una sección o tab "Definición" editable con esos campos, con autoguardado. Debe quedar visible y a mano, porque será la referencia de las compuertas de revisión. Actualiza el seed para que los proyectos de ejemplo tengan su definición.
```

### Fase E2 — Ciclo de vida del módulo

```
Extiende la app Hilo (migración aditiva). Dale ciclo de vida a los módulos para que sean la unidad que se cierra.

Migración: agrega a la tabla modulos el campo estado (abierto | en_revision | cerrado), default 'abierto'.

UI: en el detalle de proyecto, el encabezado de cada módulo muestra su estado con un chip y tiene acciones para transicionar: "Enviar a revisión" (abierto → en_revision), "Cerrar" (→ cerrado) y "Reabrir" (→ abierto). Por ahora las transiciones son manuales; en la Fase E4 el cierre pasará por la compuerta de revisión. Un módulo cerrado se muestra colapsado/atenuado. El % de avance del proyecto pasa a considerar módulos cerrados, no solo tareas hechas.
```

### Fase E3 — Corrección como tipo + check de intención

```
Extiende la app Hilo (migración aditiva). Agrega dos elementos transversales de la metodología.

Migración: a la tabla tareas agrega tipo (tarea | correccion, default 'tarea') y criterio (texto: el "cómo sé que está listo").

UI: en el detalle de tarea muestra un campo "Criterio: ¿cómo sé que está listo?" (texto corto, editable inline) y un chip de tipo (tarea / corrección). En el quick-add, default tipo = tarea. En las listas, distingue visualmente una corrección de una tarea. Esto habilita ver cuánto del trabajo es crear vs. arreglar (tasa de corrección).
```

### Fase E4 — Compuerta interna (responsables de visión)

```
Extiende la app Hilo (migración aditiva). Implementa la compuerta interna de revisión.

Migración: agrega a proyectos el campo responsable_vision_id (fk personas, nullable) — quién tiene la visión del producto. A la tabla comentarios agrega modulo_id (nullable) y haz tarea_id nullable, para poder comentar también sobre un módulo (feedback de revisión). Opcional: una tabla modulo_revisiones (modulo_id, revisor_id, resultado [aprobado | devuelto], created_at) para historial.

Flujo: cuando un módulo pasa a "en_revision", aparece en una nueva vista "Revisiones" para el responsable de visión. Ahí ve el módulo y sus tareas junto a la Definición del producto (la referencia), puede dejar feedback como comentarios sobre el módulo, y decide: "Aprobar" (→ cerrado) o "Devolver" (→ abierto, con el feedback visible). Solo el responsable de visión del proyecto puede aprobar. Este flujo reemplaza el cierre manual de la Fase E2.
```

### Fase E5 — Compuerta externa (cliente)

```
Extiende la app Hilo (migración aditiva). Implementa la compuerta externa con el cliente.

Migración: crea la tabla clientes (id, nombre, contacto, proyecto_id fk) — un cliente por proyecto. Agrega 'cliente' al enum de tipo de la tabla reuniones. Las correcciones se ligan a su módulo usando el modulo_id que ya existe (vía la tarea).

Flujo: una reunión de tipo "cliente" funciona como las demás, pero su extracción con IA produce principalmente correcciones (el feedback del cliente). Al confirmar en la vista de revisión, esas correcciones se crean con tipo = correccion ligadas a su módulo. Si una corrección toca un módulo que ya estaba "cerrado", el módulo se reabre (→ abierto) y se avisa en la UI. Agrega una sección por proyecto que muestre las correcciones de cliente abiertas y un marcador del último "cierre con cliente".
```

---

## Notas
- **Todas las migraciones son aditivas** — no rompen datos existentes. Aplica una fase, verifica que funcione, y sigue.
- **Orden:** E3 va antes que E4/E5 porque el tipo "corrección" lo usan las compuertas. E4 (interna) antes que E5 (externa) por lógica del flujo.
- Después de E5, Hilo encarna el modelo completo: producto definido → módulos que se iteran y cierran → compuerta de visión interna → compuerta de cliente externa, rápido.
- La validación automática de lógica (tests, tipos) vive en tu repo/CI, fuera de Hilo. Hilo opera la compuerta de **juicio humano** (la revisión de visión), que es donde se valida la UI.

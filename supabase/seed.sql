-- Seed de Thread. UUIDs fijos para que las FKs se lean claras.
-- Idempotente vía on conflict do nothing en las raíces.

-- ── Personas (1 po, 3 dev) ────────────────────────────────────────────────────
insert into personas (id, nombre, email, rol, color) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana Ruiz',    'ana@thread.app',   'po',  '#c96442'),
  ('a0000000-0000-0000-0000-000000000002', 'Bruno Páez',  'bruno@thread.app', 'dev', '#3b7dd8'),
  ('a0000000-0000-0000-0000-000000000003', 'Carla Soto',  'carla@thread.app', 'dev', '#2e9e7b'),
  ('a0000000-0000-0000-0000-000000000004', 'Diego León',  'diego@thread.app', 'dev', '#9a5cc4')
on conflict (id) do nothing;

-- ── Proyectos ─────────────────────────────────────────────────────────────────
insert into proyectos (id, nombre, descripcion, color, estado, que_es, para_quien, problema) values
  ('b0000000-0000-0000-0000-000000000001', 'Thread App',      'Gestor de proyectos y tareas del equipo.', '#c96442', 'activo',
   'Una herramienta liviana para gestionar proyectos, tareas y sprints de un equipo chico.',
   'Equipos de producto de 3 a 8 personas que arman software sin process pesado.',
   'Las herramientas existentes son o demasiado rígidas o demasiado libres; el equipo pierde el norte del producto entre tickets.'),
  ('b0000000-0000-0000-0000-000000000002', 'Portal Clientes', 'Portal de autogestión para clientes.',      '#3b7dd8', 'activo',
   'Un portal donde el cliente consulta su estado, facturas y tickets sin escribir un mail.',
   'Clientes B2B de la agencia que hoy piden todo por mail o teléfono.',
   'El soporte se satura con consultas repetidas que el cliente podría resolver solo.')
on conflict (id) do nothing;

-- ── Módulos ───────────────────────────────────────────────────────────────────
insert into modulos (id, proyecto_id, nombre, descripcion, orden, estado) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Autenticación', 'Login, registro y sesiones.',        0, 'en_revision'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Tablero',       'Vista de proyectos y tareas.',       1, 'abierto'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Reuniones',     'Planning, retro y sync.',            2, 'abierto'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'Catálogo',      'Listado y detalle de productos.',    0, 'cerrado'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Checkout',      'Carrito y pago.',                    1, 'abierto')
on conflict (id) do nothing;

-- ── Sprint activo en Thread App ───────────────────────────────────────────────
insert into sprints (id, proyecto_id, nombre, objetivo, fecha_inicio, fecha_fin, estado) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'Sprint 1', 'Dejar login y tablero usables.', current_date - 3, current_date + 11, 'activo')
on conflict (id) do nothing;

-- ── Reunión sprint_planning ligada al sprint ──────────────────────────────────
insert into reuniones (id, proyecto_id, sprint_id, tipo, titulo, fecha, notas) values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001', 'sprint_planning', 'Planning Sprint 1',
   current_date - 3,
   'Definimos alcance del Sprint 1: priorizar login y la vista de tablero. '
   || 'Bruno toma auth, Carla el tablero. Diego apoya en reuniones. '
   || 'Pendiente: decidir proveedor de email para recuperación de contraseña.')
on conflict (id) do nothing;

-- ── Asistentes de la reunión ──────────────────────────────────────────────────
insert into reunion_asistentes (reunion_id, persona_id) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003')
on conflict do nothing;

-- ── Tareas ────────────────────────────────────────────────────────────────────
-- Las f01..f03 nacieron en el planning (reunion_id seteado) y van al sprint activo.
insert into tareas (id, modulo_id, titulo, descripcion, responsable_id, estado, fecha, sprint_id, reunion_id) values
  -- creadas desde la reunión de planning, asignadas, en el sprint activo
  ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Pantalla de login', 'Form de email + contraseña contra Supabase Auth.',
   'a0000000-0000-0000-0000-000000000002', 'en_curso', current_date + 2,
   'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001'),

  ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
   'Grid de proyectos', 'Tarjetas con avance y miembros.',
   'a0000000-0000-0000-0000-000000000003', 'en_curso', current_date + 4,
   'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001'),

  ('f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003',
   'Vista de reunión', 'Detalle con notas y tareas derivadas.',
   'a0000000-0000-0000-0000-000000000004', 'proximo', current_date + 7,
   'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001'),

  -- tareas del sprint sin reunión de origen
  ('f0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001',
   'Recuperar contraseña', 'Flujo de reset por email.',
   'a0000000-0000-0000-0000-000000000002', 'proximo', null,
   'd0000000-0000-0000-0000-000000000001', null),

  -- backlog (sin sprint) Thread App
  ('f0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002',
   'Filtro por estado', 'Filtrar tablero por proximo/en_curso/hecho.',
   null, 'proximo', null, null, null),

  -- Portal Clientes
  ('f0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000004',
   'Listado de productos', 'Grilla paginada del catálogo.',
   'a0000000-0000-0000-0000-000000000003', 'hecho', current_date - 1, null, null),
  ('f0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000005',
   'Carrito', 'Agregar/quitar items y total.',
   'a0000000-0000-0000-0000-000000000004', 'proximo', null, null, null)
on conflict (id) do nothing;

-- ── Comentarios ───────────────────────────────────────────────────────────────
insert into comentarios (id, tarea_id, autor_id, texto, para_po, resuelto) values
  ('00000000-0000-0000-0000-0000000000c1', 'f0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000002', '¿Usamos magic link o contraseña? Necesito definición.', true, false),
  ('00000000-0000-0000-0000-0000000000c2', 'f0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000003', 'Avanzando con las tarjetas, falta la barra de progreso.', false, false)
on conflict (id) do nothing;

-- Feedback de revisión sobre el módulo en revisión (Autenticación): comentario de módulo.
insert into comentarios (id, tarea_id, modulo_id, autor_id, texto, para_po, resuelto) values
  ('00000000-0000-0000-0000-0000000000c3', null, 'c0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'Repasemos contra la Definición: falta cubrir el flujo de recuperar contraseña antes de cerrar.',
   false, false)
on conflict (id) do nothing;

-- ── Pulsos del sprint ─────────────────────────────────────────────────────────
insert into pulsos (id, sprint_id, persona_id, texto) values
  ('00000000-0000-0000-0000-0000000000d1', 'd0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000002', 'Login casi listo, bien de tiempo.'),
  ('00000000-0000-0000-0000-0000000000d2', 'd0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000003', 'Tablero trabado por definición de diseño.')
on conflict (id) do nothing;

-- ── Tipo y criterio de tareas (ejes transversales) ───────────────────────────
-- Update posterior para no tocar el insert de tareas (columnas explícitas).
update tareas
  set tipo = 'correccion',
      criterio = 'El login deja de fallar con tildes en el email y hay un test que lo cubre.'
  where id = 'f0000000-0000-0000-0000-000000000001';

update tareas
  set criterio = 'La barra de progreso refleja el avance real del tablero en tiempo real.'
  where id = 'f0000000-0000-0000-0000-000000000002';

update tareas
  set criterio = 'La grilla pagina de a 20 y carga la página 2 sin recargar.'
  where id = 'f0000000-0000-0000-0000-000000000006';

-- ── Responsable de visión por proyecto (Ana Ruiz, la PO) ──────────────────────
-- La compuerta de revisión: solo ella aprueba/devuelve módulos en revisión.
update proyectos
  set responsable_vision_id = 'a0000000-0000-0000-0000-000000000001'
  where id in (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
  );

-- ── Compuerta externa: cliente por proyecto ───────────────────────────────────
insert into clientes (id, nombre, contacto, proyecto_id) values
  ('c1000000-0000-0000-0000-000000000001', 'Equipo interno', 'ana@thread.app',
   'b0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'Cliente Acme', 'contacto@acme.com',
   'b0000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

-- ── Reunión de tipo 'cliente' (cierre con cliente en Portal Clientes) ─────────
insert into reuniones (id, proyecto_id, sprint_id, tipo, titulo, fecha, notas) values
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   null, 'cliente', 'Revisión con Acme',
   current_date - 2,
   'Acme revisó el catálogo entregado. Pidieron: que el precio se muestre con IVA incluido y '
   || 'que el filtro por categoría no pierda la selección al paginar.')
on conflict (id) do nothing;

-- ── Corrección de cliente abierta sobre un módulo CERRADO (Catálogo) ──────────
-- Simula el feedback ya confirmado: tipo 'correccion', ligada a la reunión de cliente.
insert into tareas (id, modulo_id, titulo, descripcion, responsable_id, estado, fecha, sprint_id, reunion_id, tipo, criterio) values
  ('f0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004',
   'Mostrar precios con IVA incluido', 'Pedido del cliente Acme en la revisión.',
   'a0000000-0000-0000-0000-000000000003', 'proximo', null,
   null, 'e0000000-0000-0000-0000-000000000002',
   'correccion', 'El precio del catálogo se muestra con IVA incluido en todas las vistas.')
on conflict (id) do nothing;

-- La corrección tocó un módulo cerrado: el módulo se reabre.
update modulos
  set estado = 'abierto'
  where id = 'c0000000-0000-0000-0000-000000000004';

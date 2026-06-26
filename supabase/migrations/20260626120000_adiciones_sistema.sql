-- Alterar el enum de estado de tarea para incluir 'revision'
ALTER TYPE estado_tarea ADD VALUE IF NOT EXISTS 'revision';

-- Crear tabla de dependencias entre tareas (bloqueos)
CREATE TABLE IF NOT EXISTS tarea_dependencias (
  bloqueadora_id uuid NOT NULL REFERENCES tareas (id) ON DELETE CASCADE,
  bloqueada_id uuid NOT NULL REFERENCES tareas (id) ON DELETE CASCADE,
  PRIMARY KEY (bloqueadora_id, bloqueada_id),
  CONSTRAINT check_no_auto_bloqueo CHECK (bloqueadora_id <> bloqueada_id)
);

-- Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES personas (id) ON DELETE CASCADE,
  autor_id uuid REFERENCES personas (id) ON DELETE SET NULL,
  tipo text NOT NULL, -- 'mencion', 'asignacion', 'comentario', 'vencimiento'
  texto text NOT NULL,
  leido boolean NOT NULL DEFAULT false,
  tarea_id uuid REFERENCES tareas (id) ON DELETE CASCADE,
  proyecto_id uuid REFERENCES proyectos (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para mejorar rendimiento de búsquedas
CREATE INDEX IF NOT EXISTS idx_tarea_dependencias_bloqueada ON tarea_dependencias (bloqueada_id);
CREATE INDEX IF NOT EXISTS idx_tarea_dependencias_bloqueadora ON tarea_dependencias (bloqueadora_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_persona ON notificaciones (persona_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leido ON notificaciones (leido);

-- RLS
ALTER TABLE tarea_dependencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS permisivas para authenticated (idénticas a las existentes en el proyecto)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tarea_dependencias' AND policyname = 'auth_all_tarea_dependencias'
  ) THEN
    CREATE POLICY auth_all_tarea_dependencias ON tarea_dependencias FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notificaciones' AND policyname = 'auth_all_notificaciones'
  ) THEN
    CREATE POLICY auth_all_notificaciones ON notificaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Habilitar Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tarea_dependencias;
ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;

-- REPLICA IDENTITY FULL para eventos de actualización/eliminación completos
ALTER TABLE notificaciones REPLICA IDENTITY FULL;

// Tipos del esquema de Supabase.
// Formato compatible con `supabase gen types typescript`.
// Regenerar tras cambios de esquema (ver CLAUDE.md → "Base de datos").
// `Relationships: []` por tabla es lo mínimo que exige supabase-js para tipar
// insert/update; al regenerar con `gen types` se llena con las FKs reales y habilita
// inferencia en selects anidados tipo `.select('*, modulos(*)')`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      personas: {
        Relationships: []
        Row: {
          id: string
          nombre: string
          email: string
          rol: Database['public']['Enums']['rol_persona']
          color: string
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          email: string
          rol: Database['public']['Enums']['rol_persona']
          color?: string
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          email?: string
          rol?: Database['public']['Enums']['rol_persona']
          color?: string
          activo?: boolean
          created_at?: string
        }
      }
      proyectos: {
        Relationships: []
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          color: string
          estado: Database['public']['Enums']['estado_proyecto']
          que_es: string | null
          para_quien: string | null
          problema: string | null
          responsable_vision_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          color?: string
          estado?: Database['public']['Enums']['estado_proyecto']
          que_es?: string | null
          para_quien?: string | null
          problema?: string | null
          responsable_vision_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          color?: string
          estado?: Database['public']['Enums']['estado_proyecto']
          que_es?: string | null
          para_quien?: string | null
          problema?: string | null
          responsable_vision_id?: string | null
          created_at?: string
        }
      }
      modulos: {
        Relationships: []
        Row: {
          id: string
          proyecto_id: string
          nombre: string
          descripcion: string | null
          orden: number
          estado: Database['public']['Enums']['estado_modulo']
        }
        Insert: {
          id?: string
          proyecto_id: string
          nombre: string
          descripcion?: string | null
          orden?: number
          estado?: Database['public']['Enums']['estado_modulo']
        }
        Update: {
          id?: string
          proyecto_id?: string
          nombre?: string
          descripcion?: string | null
          orden?: number
          estado?: Database['public']['Enums']['estado_modulo']
        }
      }
      sprints: {
        Relationships: []
        Row: {
          id: string
          proyecto_id: string
          nombre: string
          objetivo: string | null
          fecha_inicio: string | null
          fecha_fin: string | null
          estado: Database['public']['Enums']['estado_sprint']
          cierre_logros: string | null
          cierre_pegados: string | null
          cierre_cambio: string | null
          created_at: string
        }
        Insert: {
          id?: string
          proyecto_id: string
          nombre: string
          objetivo?: string | null
          fecha_inicio?: string | null
          fecha_fin?: string | null
          estado?: Database['public']['Enums']['estado_sprint']
          cierre_logros?: string | null
          cierre_pegados?: string | null
          cierre_cambio?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          proyecto_id?: string
          nombre?: string
          objetivo?: string | null
          fecha_inicio?: string | null
          fecha_fin?: string | null
          estado?: Database['public']['Enums']['estado_sprint']
          cierre_logros?: string | null
          cierre_pegados?: string | null
          cierre_cambio?: string | null
          created_at?: string
        }
      }
      reuniones: {
        Relationships: []
        Row: {
          id: string
          proyecto_id: string
          sprint_id: string | null
          tipo: Database['public']['Enums']['tipo_reunion']
          titulo: string
          fecha: string
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          proyecto_id: string
          sprint_id?: string | null
          tipo: Database['public']['Enums']['tipo_reunion']
          titulo: string
          fecha?: string
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          proyecto_id?: string
          sprint_id?: string | null
          tipo?: Database['public']['Enums']['tipo_reunion']
          titulo?: string
          fecha?: string
          notas?: string | null
          created_at?: string
        }
      }
      tareas: {
        Relationships: []
        Row: {
          id: string
          modulo_id: string
          titulo: string
          descripcion: string | null
          responsable_id: string | null
          estado: Database['public']['Enums']['estado_tarea']
          fecha: string | null
          sprint_id: string | null
          reunion_id: string | null
          tipo: Database['public']['Enums']['tipo_tarea']
          criterio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          modulo_id: string
          titulo: string
          descripcion?: string | null
          responsable_id?: string | null
          estado?: Database['public']['Enums']['estado_tarea']
          fecha?: string | null
          sprint_id?: string | null
          reunion_id?: string | null
          tipo?: Database['public']['Enums']['tipo_tarea']
          criterio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          modulo_id?: string
          titulo?: string
          descripcion?: string | null
          responsable_id?: string | null
          estado?: Database['public']['Enums']['estado_tarea']
          fecha?: string | null
          sprint_id?: string | null
          reunion_id?: string | null
          tipo?: Database['public']['Enums']['tipo_tarea']
          criterio?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      comentarios: {
        Relationships: []
        Row: {
          id: string
          tarea_id: string | null
          modulo_id: string | null
          autor_id: string
          texto: string
          para_po: boolean
          resuelto: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tarea_id?: string | null
          modulo_id?: string | null
          autor_id: string
          texto: string
          para_po?: boolean
          resuelto?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tarea_id?: string | null
          modulo_id?: string | null
          autor_id?: string
          texto?: string
          para_po?: boolean
          resuelto?: boolean
          created_at?: string
        }
      }
      modulo_revisiones: {
        Relationships: []
        Row: {
          id: string
          modulo_id: string
          revisor_id: string | null
          resultado: string
          created_at: string
        }
        Insert: {
          id?: string
          modulo_id: string
          revisor_id?: string | null
          resultado: string
          created_at?: string
        }
        Update: {
          id?: string
          modulo_id?: string
          revisor_id?: string | null
          resultado?: string
          created_at?: string
        }
      }
      clientes: {
        Relationships: []
        Row: {
          id: string
          nombre: string
          contacto: string | null
          proyecto_id: string
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          contacto?: string | null
          proyecto_id: string
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          contacto?: string | null
          proyecto_id?: string
          created_at?: string
        }
      }
      pulsos: {
        Relationships: []
        Row: {
          id: string
          sprint_id: string
          persona_id: string
          texto: string
          created_at: string
        }
        Insert: {
          id?: string
          sprint_id: string
          persona_id: string
          texto: string
          created_at?: string
        }
        Update: {
          id?: string
          sprint_id?: string
          persona_id?: string
          texto?: string
          created_at?: string
        }
      }
      reunion_asistentes: {
        Relationships: []
        Row: {
          reunion_id: string
          persona_id: string
        }
        Insert: {
          reunion_id: string
          persona_id: string
        }
        Update: {
          reunion_id?: string
          persona_id?: string
        }
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: {
      rol_persona: 'po' | 'dev'
      estado_proyecto: 'activo' | 'pausado' | 'cerrado'
      estado_modulo: 'abierto' | 'en_revision' | 'cerrado'
      estado_tarea: 'proximo' | 'en_curso' | 'hecho'
      estado_sprint: 'planificado' | 'activo' | 'cerrado'
      tipo_reunion: 'sprint_planning' | 'retro' | 'sync' | 'otro' | 'cliente'
      tipo_tarea: 'tarea' | 'correccion'
    }
    CompositeTypes: Record<never, never>
  }
}

// Atajos de uso.
type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]

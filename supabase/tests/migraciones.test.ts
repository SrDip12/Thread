// Aplica TODAS las migraciones sobre un Postgres embebido (PGlite) con stubs mínimos de
// Supabase (roles, auth.uid/jwt, publicación realtime) y prueba los triggers y funciones
// de avisos, aprobación, vencimientos y salud de cartera. Sin Docker ni red.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

const raiz = path.resolve(__dirname, '..')

const U = { ana: '00000000-0000-0000-0000-00000000000a', beto: '00000000-0000-0000-0000-00000000000b', caro: '00000000-0000-0000-0000-00000000000c' }
const P = { ana: '10000000-0000-0000-0000-00000000000a', beto: '10000000-0000-0000-0000-00000000000b', caro: '10000000-0000-0000-0000-00000000000c' }
const PROY = '20000000-0000-0000-0000-000000000001'
const MOD = '30000000-0000-0000-0000-000000000001'
const T1 = '40000000-0000-0000-0000-000000000001'

let db: PGlite

async function migrar(): Promise<PGlite> {
  const pg = new PGlite()
  await pg.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
    create publication supabase_realtime;
  `)
  const dir = path.join(raiz, 'migrations')
  for (const f of readdirSync(dir).sort()) {
    await pg.exec(readFileSync(path.join(dir, f), 'utf8'))
  }
  return pg
}

async function como(uid: string | null, email: string, role = 'authenticated') {
  await db.query(`select set_config('test.uid', $1, false), set_config('test.jwt', $2, false)`, [
    uid ?? '',
    JSON.stringify({ email, role }),
  ])
}

async function notifs() {
  const r = await db.query<{ para: string; tipo: string; evento: string | null }>(
    `select p.nombre as para, n.tipo, n.evento from notificaciones n join personas p on p.id = n.persona_id order by n.created_at, n.tipo`,
  )
  return r.rows
}

const estado = (e: string) => db.query(`update tareas set estado = $1 where id = $2`, [e, T1])

beforeAll(async () => {
  db = await migrar()
  await db.exec(`
    insert into auth.users values ('${U.ana}','ana@x.com'),('${U.beto}','beto@x.com'),('${U.caro}','caro@x.com');
    insert into personas (id, nombre, email, rol, user_id) values
      ('${P.ana}','Ana Ruiz','ana@x.com','dev','${U.ana}'),
      ('${P.beto}','Beto','beto@x.com','dev','${U.beto}'),
      ('${P.caro}','Caro','caro@x.com','po','${U.caro}');
    insert into proyectos (id, nombre, responsable_vision_id) values ('${PROY}','P1','${P.beto}');
    insert into modulos (id, proyecto_id, nombre) values ('${MOD}','${PROY}','M1');
  `)
}, 60_000)

beforeEach(async () => {
  await db.exec('delete from notificaciones')
})

describe('seed', () => {
  it('carga sobre las migraciones', async () => {
    const pg = await migrar()
    await pg.exec(readFileSync(path.join(raiz, 'seed.sql'), 'utf8'))
    const r = await pg.query<{ n: number }>('select count(*)::int as n from tareas')
    expect(r.rows[0].n).toBeGreaterThan(0)
  }, 60_000)
})

describe('persona_actual_id', () => {
  it('resuelve por uid o por email sin distinguir mayúsculas', async () => {
    await como(U.ana, 'ana@x.com')
    expect((await db.query<{ id: string }>('select persona_actual_id() as id')).rows[0].id).toBe(P.ana)
    await como(null, 'ANA@x.com')
    expect((await db.query<{ id: string }>('select persona_actual_id() as id')).rows[0].id).toBe(P.ana)
  })
})

describe('trigger de tareas', () => {
  it('avisa la asignación a otro, no la autoasignación', async () => {
    await como(U.ana, 'ana@x.com')
    await db.query(`insert into tareas (id, modulo_id, titulo, responsable_id) values ($1, $2, 'T1', $3)`, [T1, MOD, P.beto])
    expect(await notifs()).toEqual([{ para: 'Beto', tipo: 'asignacion', evento: null }])
    await db.exec('delete from notificaciones')
    await db.query(`update tareas set responsable_id = $1 where id = $2`, [P.ana, T1])
    expect(await notifs()).toEqual([])
  })

  it('entrar a revisión avisa al responsable de visión', async () => {
    await como(U.ana, 'ana@x.com')
    await estado('revision')
    expect(await notifs()).toEqual([{ para: 'Beto', tipo: 'revision', evento: 'envio_revision' }])
  })

  it('solo visión / PO / service_role pueden aprobar', async () => {
    await como(U.ana, 'ana@x.com')
    await expect(estado('hecho')).rejects.toThrow(/responsable de visión/)

    await como(U.beto, 'beto@x.com')
    await estado('hecho')
    expect(await notifs()).toEqual([{ para: 'Ana Ruiz', tipo: 'revision', evento: 'aprobo' }])

    await como(U.caro, 'caro@x.com')
    await estado('revision')
    await estado('hecho')

    await como(null, '', 'service_role')
    await estado('revision')
    await estado('hecho')
  })

  it('devolver avisa al responsable', async () => {
    await como(U.caro, 'caro@x.com')
    await estado('revision')
    await db.exec('delete from notificaciones')
    await estado('en_curso')
    expect(await notifs()).toEqual([{ para: 'Ana Ruiz', tipo: 'revision', evento: 'devolvio' }])
  })
})

describe('trigger de comentarios', () => {
  it('mención y comentario al responsable, sin duplicar', async () => {
    await como(U.caro, 'caro@x.com')
    await db.query(`insert into comentarios (tarea_id, autor_id, texto) values ($1, $2, 'ojo @beto con esto')`, [T1, P.caro])
    const n = await notifs()
    expect(n).toHaveLength(2)
    expect(n).toContainEqual({ para: 'Beto', tipo: 'mencion', evento: null })
    expect(n).toContainEqual({ para: 'Ana Ruiz', tipo: 'comentario', evento: null })
  })

  it('pregunta para el PO avisa al responsable de visión', async () => {
    await como(U.ana, 'ana@x.com')
    await db.query(`insert into comentarios (tarea_id, autor_id, texto, para_po) values ($1, $2, '¿y esto?', true)`, [T1, P.ana])
    expect(await notifs()).toEqual([{ para: 'Beto', tipo: 'pregunta', evento: null }])
  })
})

describe('generar_avisos_vencimiento', () => {
  it('cada persona genera solo las suyas; el cron, las de todos; idempotente', async () => {
    await db.query(
      `insert into tareas (modulo_id, titulo, responsable_id, fecha) values
        ($1, 'Vence', $2, current_date - 1),
        ($1, 'Lejos', $2, current_date + 10),
        ($1, 'DeBeto', $3, current_date)`,
      [MOD, P.ana, P.beto],
    )
    await db.exec('delete from notificaciones')
    const gen = async (arg = '') =>
      (await db.query<{ n: number }>(`select generar_avisos_vencimiento(${arg}) as n`)).rows[0].n

    await como(U.ana, 'ana@x.com')
    expect(await gen()).toBe(1)
    expect(await gen(`'${P.beto}'`)).toBe(0)

    await como(null, '', 'service_role')
    expect(await gen()).toBe(1)
    expect(await gen()).toBe(0)
  })
})

describe('v_salud_proyectos', () => {
  it('agrega por proyecto', async () => {
    const r = await db.query<{ total: number; vencidas: number; ultima_actividad: string | null }>(
      'select * from v_salud_proyectos where proyecto_id = $1',
      [PROY],
    )
    expect(r.rows[0].total).toBe(4)
    expect(r.rows[0].vencidas).toBe(1)
    expect(r.rows[0].ultima_actividad).not.toBeNull()
  })
})

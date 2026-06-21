# Manual de despliegue — Cloudflare Pages

Guía para desplegar **Thread** en Cloudflare Pages (sitio Vite + Pages Functions).

## Requisitos previos

- Repo en GitHub/GitLab (o usar deploy por CLI).
- Cuenta de Cloudflare.
- Proyecto de Supabase (URL + anon key).
- API key de Groq (para la extracción de tareas con IA).

## Configuración del build

| Ajuste | Valor |
|---|---|
| Framework preset | Vite (o None) |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `20` (lo toma de `.node-version`, o seteá `NODE_VERSION=20`) |

> `wrangler.toml` ya define `pages_build_output_dir = dist`. Las Functions de `/functions` se despliegan solas junto al sitio.

## Variables de entorno

Settings → Environment variables:

| Variable | Tipo | Por qué |
|---|---|---|
| `VITE_SUPABASE_URL` | **Plain** | Pública; Vite la inyecta en build |
| `VITE_SUPABASE_ANON_KEY` | **Plain** | Pública; Vite la inyecta en build |
| `GROQ_API_KEY` | **Secret/Encrypted** | Solo la Function la lee en runtime; nunca llega al cliente |
| `NODE_VERSION` | Plain | `20`, si el preset no toma `.node-version` |

> Las `VITE_*` van como **plain** porque se hornean en el bundle (son públicas). `GROQ_API_KEY` va como **secret** porque solo la usa la Pages Function del lado servidor.

## Pasos (conectar repo a Git)

1. Push del repo a GitHub/GitLab.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**. Elegí el repo.
3. Build settings: preset **Vite**, build command `npm run build`, output dir `dist`.
4. Cargá las variables de entorno (tabla de arriba).
5. **Deploy**. Cada push redeploya automáticamente.

## Alternativa: deploy por CLI

```bash
npm run build                              # genera dist/
npx wrangler pages deploy dist             # sube el build
npx wrangler pages secret put GROQ_API_KEY # setea el secret (remoto)
```

## Antes de desplegar (Supabase)

Aplicá migraciones y, si usás Realtime, la migración correspondiente:

```bash
supabase link --project-ref <ref>
supabase db push
```

La migración `…_realtime.sql` agrega las tablas a la publicación `supabase_realtime` (necesaria para los cambios en vivo).

## Verificar el deploy

1. Abrí la URL `*.pages.dev`.
2. Login email+password → debe cargar `/proyectos`.
3. Probá la extracción IA en una reunión → confirma que `POST /extraer-tareas` responde (valida `GROQ_API_KEY`).

## Probar Functions en local

`vite dev` **no** ejecuta las Functions. Para probarlas:

```bash
npx wrangler pages dev   # sirve app + /functions
```

Con el secret local: `.dev.vars` con `GROQ_API_KEY=...` (no commitear).

# Contributing to Thread

Thanks for your interest in Thread! This guide gets you from clone to merged PR.

## Ground rules

- **UI is in Spanish, code & docs in English.** User-facing strings, routes and labels are Spanish
  (`/mis-tareas`, "Revisiones"). Identifiers, comments and documentation are English.
- **TypeScript strict.** No `any`, no unused variables/params — the build fails on them.
- **Functional components only.** State/effect logic goes in hooks.
- **No component imports `supabase` or queries directly.** All data I/O lives in `src/data/<entity>.ts`
  hooks (TanStack Query, optimistic updates). Add a hook there, not inline in a component.
- **Design tokens only.** Colors come from `src/index.css` `@theme` tokens (`bg-canvas`, `text-ink`,
  `bg-brand`, semantic `--color-danger|warn|info|ok`…). No loose hex in `.tsx`/`.ts` except the documented
  per-project accent palette. Both light and dark themes must work.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, schema and conventions.

## Development setup

```bash
npm install
cp .env.example .env        # add your Supabase URL + anon key
supabase start             # local Postgres with migrations + seed (needs Docker)
npm run dev                # Vite dev server
```

For the AI Edge Functions (`/api`) and the meeting-extraction feature, run `vercel dev` with a
`GROQ_API_KEY` in `.env.local`.

## Before you open a PR

```bash
npm run typecheck          # tsc -b
npm run build              # tsc -b && vite build — must pass
```

If you changed the database schema:

```bash
supabase gen types typescript --local > src/lib/database.types.ts
```

and add a versioned migration under `supabase/migrations/`.

## Commit & PR conventions

- Use clear, imperative commit subjects. [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `docs:`…) are encouraged.
- Keep PRs focused; one logical change per PR.
- Fill in the PR template: what changed, why, and how you verified it.
- Reference the issue you're closing (`Closes #123`).

## Areas that welcome help

- More MCP tools (sprints, meetings, pulses) in `mcp/server.mjs`.
- i18n: extracting UI strings so the interface can support languages beyond Spanish.
- Tightening RLS (see the hardening plan in `CLAUDE.md`).
- Tests — there's no test suite yet; a first Vitest setup is very welcome.
- Screenshots and docs.

By contributing you agree your work is licensed under the project's [MIT License](./LICENSE).

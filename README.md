<div align="center">

# 🧵 Thread

**AI-native project management. Run your team's work by talking to Claude.**

Thread is an open-source project & task manager where meetings become tasks with one click,
work moves through a real review gate, and your whole backlog is reachable from an AI assistant
through the [Model Context Protocol](https://modelcontextprotocol.io) — no dashboard required.

[![CI](https://github.com/SrDip12/Thread/actions/workflows/ci.yml/badge.svg)](https://github.com/SrDip12/Thread/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-c96442.svg)](./LICENSE)
[![React 19](https://img.shields.io/badge/React-19-149eca.svg)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e.svg)](https://supabase.com)
[![MCP](https://img.shields.io/badge/MCP-server-6f56d9.svg)](https://modelcontextprotocol.io)

[Features](#features) · [Quickstart](#quickstart) · [The MCP server](#-the-mcp-server) · [Architecture](#architecture) · [Contributing](./CONTRIBUTING.md)

</div>

> **UI language:** Thread's interface is in **Spanish** by design (built for Spanish-speaking teams).
> The code, docs, and this README are in English so anyone can contribute.

---

## Why Thread

Most task managers are a place you go *to*. Thread is built to come *to you* — through the tools your
team already lives in. The headline feature isn't a Kanban board (it has one); it's that the same tasks,
reviews, and assignments are a first-class **MCP surface**, so a developer can say *"start the login task"*
or *"send the payments API to review"* to Claude and it just happens, with the same permissions and
notifications as the web app.

## Features

- **🤖 MCP server** — 14 tools exposing tasks over the Model Context Protocol. List, create, start,
  complete, send-to-review, approve/return, comment and assign — from Claude Code, Claude Desktop, or any
  MCP client. Each teammate runs it with their own login, so RLS and notifications are identical to the web.
- **🧠 Meetings → tasks with AI** — paste raw meeting notes; a Groq-backed LLM extracts structured tasks
  (title, suggested owner, module, due date). Nothing is created without human review.
- **🔍 Review gates** — tasks move to a `revision` state and land in a reviewer's inbox to approve or return
  with a reason; modules have a separate "vision owner" gate against a written Definition.
- **⚡ Realtime collaboration** — task, comment and team-chat changes stream live between members via
  Supabase Realtime.
- **🗓️ Sprints, Gantt & calendar** — lightweight time-boxes orthogonal to modules, a dependency-aware Gantt,
  and a calendar that merges meetings with your own due dates.
- **🔔 In-app notifications** — assignment, mentions, comments, review transitions and due-date alerts.
- **🎨 Warm, considered design** — a bone-canvas / terracotta system with full light & dark themes, built on
  design tokens; no loose hex in components.

## Screenshots

> _Add screenshots to `docs/screenshots/` and reference them here._ The visual language (bone canvas
> `#faf9f7`, terracotta `#c96442`, Manrope + JetBrains Mono) lives in `/design`.

| Today view | Project detail | Talking to Claude (MCP) |
|:---:|:---:|:---:|
| _hoy.png_ | _proyecto.png_ | _mcp.png_ |

## Quickstart

**Requirements:** Node.js 20+, a [Supabase](https://supabase.com) project, and (optional) a
[Groq](https://groq.com) API key for the AI features.

```bash
git clone https://github.com/SrDip12/Thread.git
cd Thread
npm install
cp .env.example .env      # fill in your Supabase URL + anon key
```

Set up the database (requires the [Supabase CLI](https://supabase.com/docs/guides/local-development)):

```bash
supabase start                    # local Postgres; applies migrations + seed
# or, against a remote project:
supabase link --project-ref <ref>
supabase db push
```

Run the app:

```bash
npm run dev                       # Vite dev server (does NOT run /api functions)
vercel dev                        # app + Edge Functions (needed for the AI features)
```

Open http://localhost:5173. Full details in [`CLAUDE.md`](./CLAUDE.md).

## 🤖 The MCP server

The differentiator. `mcp/server.mjs` is a zero-build stdio MCP server that exposes Thread's tasks as tools.

```bash
# one-time, per teammate
echo "THREAD_EMAIL=you@team.com"     >> .env.local
echo "THREAD_PASSWORD=your-password" >> .env.local
npm run mcp        # or let Claude Code pick it up from .mcp.json automatically
```

Then just ask Claude: *"what do I have due today?"*, *"mark 'design navbar' as done"*,
*"send the payments API to review because error handling is missing"*.

| Tool | Does |
|---|---|
| `mis_tareas`, `listar_tareas`, `ver_tarea` | read your work / filter / detail + comments |
| `crear_tarea`, `asignar_tarea`, `comentar_tarea` | create, (re)assign, comment |
| `empezar_tarea`, `completar_tarea`, `enviar_a_revision` | move through states |
| `revisiones_pendientes`, `aprobar_tarea`, `devolver_tarea` | run the review gate |
| `listar_proyectos`, `equipo` | context |

Because it runs locally with each person's login, it inherits Supabase Row-Level Security — Claude only
sees and touches what that user could in the app. Full guide: [`mcp/README.md`](./mcp/README.md).

## Architecture

```
React 19 + TypeScript (strict)          UI, in Spanish
    ↓ TanStack Query (server state)
Supabase (Postgres + Auth + Realtime + RLS)
    ↑ direct                    ↑ direct
Vercel Edge Functions (/api)   MCP server (mcp/server.mjs, stdio, local)
    → Groq LLM (task extraction, project analysis)
```

- **No component imports `supabase` directly** — all I/O goes through `src/data/<entity>.ts` hooks
  (optimistic updates) and `src/auth/AuthProvider.tsx`.
- **Design tokens only** — colors come from `src/index.css` `@theme` tokens; both themes remap the same
  tokens, so components never know the theme.
- **The web app and the MCP server hit the same database directly.** Vercel hosts the web build and the AI
  Edge Functions; the MCP is not deployed — it's a local client.

Full conventions, schema and data-layer rules are documented in [`CLAUDE.md`](./CLAUDE.md).

## Tech stack

React 19 · TypeScript · Vite 6 · Tailwind CSS v4 · React Router v7 · TanStack Query ·
Supabase (Postgres/Auth/Realtime) · Vercel Edge Functions · Groq · Model Context Protocol SDK.

## Contributing

Issues and PRs welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md). Good first issues are labeled
[`good first issue`](https://github.com/SrDip12/Thread/labels/good%20first%20issue).

## Security

The Supabase **anon key is public by design** (it ships in the client bundle and is protected by RLS).
Real secrets (`GROQ_API_KEY`) live only in Vercel env vars, never in the repo. To report a vulnerability,
see [`SECURITY.md`](./SECURITY.md).

## Author

Built by **Benjamin Iturra** ([@SrDip12](https://github.com/SrDip12)) — dev & AI lead engineer.

## License

[MIT](./LICENSE) © 2026 Benjamin Iturra

# Security Policy

## What is and isn't a secret

- **The Supabase anon key is public by design.** It is embedded in the client bundle served to every
  browser and is protected by Postgres Row-Level Security. Seeing it in `.env.example` context or in the
  built JS is expected and not a vulnerability.
- **Real secrets** — the `GROQ_API_KEY` and any Supabase **service-role** key — must never be committed.
  They live only in Vercel environment variables (read at runtime by the Edge Functions) or in a local
  `.env.local` that is git-ignored.

## RLS status

Thread currently ships a permissive RLS baseline: any *authenticated* user can read and write all rows;
the `anon` role has no access. This is a starting point, **not** production-grade for sensitive data. A
hardening plan (mapping `auth.users` ↔ `personas`, per-operation policies, role in `app_metadata`) is
documented in `CLAUDE.md` → "RLS — estado actual y cómo endurecer". Contributions toward it are welcome.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use GitHub's
[private vulnerability reporting](https://github.com/SrDip12/Thread/security/advisories/new) or email the
maintainer. Include steps to reproduce and the impact. We aim to acknowledge reports within a few days.

## Supported versions

Thread is pre-1.0; only the latest `main` is supported.

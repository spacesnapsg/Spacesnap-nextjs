# SpaceSnap Next.js Rewrite — Project Context

This file is auto-read by Claude Code at the start of every session in this repo.
It exists so sessions don't need to rediscover architecture decisions or the old
codebase from scratch each time.

## What this project is

Full-stack rewrite of SpaceSnap Web, replacing the Laravel + Vite/React (JS) stack.
Not a parallel build — this becomes the primary product once Sprint 7 verification
passes. See `SPRINT_PLAN_NEXTJS_REWRITE.md` in this repo root for sprint-by-sprint
scope and checklists. Always check that file for current sprint status before
starting work.

## Stack (decided, do not re-litigate)

- Next.js (App Router) + TypeScript
- Backend: Next.js API routes (not a separate Express service)
- Auth: NextAuth (Auth.js v5) — Credentials provider + Prisma adapter, database
  session strategy. Not custom JWT/session.
- ORM: Prisma, with raw SQL migration for the bookings exclusion constraint
  (Prisma can't express `EXCLUDE ... USING gist`)
- DB (dev): local Postgres, database name `spacesnap_dev`
- DB (prod): Railway Postgres — dev stays local until the Sprint 2 migration step
- File storage: Cloudflare R2 (S3-compatible)
- Hosting: Railway
- `.env.testing` / isolated test DB: intentionally deferred to Sprint 3.5. Do not
  create this early unless the current sprint task explicitly says otherwise.

## Old codebase reference (read before porting anything)

The old system is two sibling repos, both on this Mac:
- `~/Documents/spacesnap-web` — Vite + React 19 (JSX), react-router-dom v7,
  Tailwind v4. Frontend only.
- `~/Documents/spacesnap-api` (or wherever it sits alongside spacesnap-web) —
  Laravel + PostgreSQL + Sanctum. Backend only.

**Do not re-explore these repos from scratch each session.** Two reference docs
already summarize them structurally — read these first:
- `CODEBASE_SUMMARY.md` — frontend: routing, component inventory, `api.js` client,
  known gaps (e.g. unwired sign-out buttons, mock notifications panel, no client
  role-gating on User/Supplier routes)
- `CODEBASEAPI_SUMMARY.md` — backend: all 70 API routes, DB schema (tables,
  constraints, the `transactions` ledger pattern), known gaps (e.g. no
  `check_ins` controller, suspend/reinstate has no functional enforcement yet)

If a task requires exact file contents beyond what these summaries cover, read
the actual file from the old repo path above — don't guess or invent structure.

## Ground rules

- **Navbars stay as three separate components** (`UserNavbar`, `SupplierNavbar`,
  `AdminNavbar`), matching the old repo. Do not consolidate into a single
  role-parameterized Navbar without explicitly flagging it as a proposed
  refactor first.
- **Never invent nav items, routes, or fields** that don't exist in the old
  repo's actual structure — port what's there, don't design fresh unless a
  task explicitly asks for new functionality.
- **Known gaps from the old build must be fixed at the point they're rebuilt,
  not deferred again** — see "Known gaps to close" sections in
  `SPRINT_PLAN_NEXTJS_REWRITE.md`, especially the Sprint 3.5 money-flow/
  Transaction-ledger items. These are re-implementations of lessons already
  learned via a dedicated data integrity audit on the old build, not new scope.
- **Trust architecture (kiosk/middleware, Sprint 5):** any API surface built
  for kiosk hardware must only ever supply credential facts, never an
  authorization verdict. The Pi decides access locally. This is a hard
  architectural boundary, not a style preference.
- **Grant/financial context:** this rewrite is not funded by or claimed under
  the Startup SG Tech POC grant. Don't reference grant budget figures in this
  repo's code, comments, or docs.

## Session hygiene

- One Claude Code session per sprint checklist item where practical.
- `/clear` between unrelated tasks; `/compact` mid-task if context gets heavy.
- This file + `SPRINT_PLAN_NEXTJS_REWRITE.md` are the persistent memory across
  sessions — don't rely on chat history carrying forward.

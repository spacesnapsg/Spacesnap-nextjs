# SpaceSnap Web — Next.js/TypeScript Rewrite Sprint Plan

Stack: Next.js (App Router) + React + TypeScript + Prisma + PostgreSQL + NextAuth (or custom JWT/session auth) + React Query + Tailwind + AWS (Elastic Beanstalk/RDS/S3 or Vercel, TBD)

Replaces the Laravel + Vite/React (JS) stack entirely. Not the parallel-build model anymore — this becomes the primary product once Sprint 7 verification passes. Old Laravel repo stays untouched/read-only as reference and rollback point until this rewrite is fully verified.

Not funded by or claimed under the Startup SG Tech POC grant.

**Ground rule carried over from the original build:** every known gap found in the original data integrity audit gets fixed *at the point it's built*, not discovered later. See "Known gaps to close" in each relevant sprint below — these are not new scope, they're re-implementing what you already learned the first time.

---

## Sprint 0: Environment & Architecture Decisions

- [x] Next.js project init (App Router, TypeScript template)
- [x] Decide: Next.js API routes
- [x] Decide: Prisma (raw SQL fallback for constraints Prisma can't express)
- [x] Decide: NextAuth — this decision shapes Sprint 3, don't defer it
- [x] Set up PostgreSQL (reuse existing schema/dump from Laravel version as starting point)
- [x] Git repo init, `.env` + `.env.example` conventions
- [x] Tailwind config with existing design tokens ported over (colors, radii, fonts — see Design Theme doc)
- [x] Railway + R2 stack for Front/Backend/DB + Video/image hosting.
- [x] Git repo at spacesnapsg-nextjs

**Checklist before moving to Sprint 1:**
- [x] Confirmed auth strategy in writing (not "figure it out during Sprint 3")
- [x] Old Laravel repo tagged/branched as a rollback reference, left running if possible

---

## Sprint 1: Static Pages & Routing (Next.js + TS + Tailwind)

- [x] Set up file-based routing matching current nav structure (user/, supplier/, admin/)
- [x] Three role-specific layouts (UserLayout/teal, SupplierLayout/purple, AdminLayout/red) as Next.js layout.tsx files
- [x] Shared components ported to TS: Navbar, Button, Card, Input
- [x] Login/Signup pages
- [x] Discover/Marketplace page + Book Now modal
- [x] Digital Passport page + cert detail modal + training tutorials
- [x] Credit Wallet page + Top Up modal
- [x] User Dashboard
- [x] Notifications panel (reusable component, both navbars)
- [x] Supplier Inventory page + Add/Edit Listing modal
- [x] Supplier Tutorials page
- [x] Supplier Requests page
- [x] Supplier Profile page
- [x] Active nav-state highlighting
- [x] Responsive/visual polish pass
- [x] Admin Page Overview
- [x] Admin Page Users and Companies
- [x] Admin Page Financials
- [x] Admin Page Certificates and Training
- [x] Admin Approvals

AdminNavbar: /admin/dashboard, /admin-users, /admin-companies, /admin-financials, /admin/certificates, and /admin-approvals now all resolve — the dead link carried over from the old app (AdminNavbar in spacesnap-web linked to it with no matching route there either) is closed. The new page consolidates pending-approval categories the backend exposes as separate endpoints (bookings, promotions, certificates) into one tabbed view. Overview's "Pending Approvals" Review buttons now route here instead of being no-ops.

**Verifications removed from this page (2026-07-18) — revisit before Sprint 3 wires the real endpoint.** Built it initially, then pulled it because its semantics are underspecified and I was guessing. What's actually known, from `CODEBASE_SUMMARY.md`:
- There's an `is_verified` boolean on `users`, explicitly documented as distinct from Laravel's `email_verified_at` — it means "System Admin reviewed and approved this user," not automatic email-ownership confirmation.
- Backend has `GET /admin/verifications/pending` and `PATCH /admin/verifications/{u}/approve` (`UserController@pendingVerifications` / `approveVerification`) — approve only, no reject endpoint exists.
- What's *not* documented anywhere (checked `Sprint_Plan.md` and the audit TODOs too): what puts a user into the pending-verification queue in the first place (auto on signup? triggered by some action? tied to an ID/doc upload that doesn't otherwise appear in the schema?), and what `is_verified` actually gates, if anything — unlike credential-gating (Sprint 4) there's no documented feature that checks this flag.
- The mock data I'd built in guessed a "user vs. supplier" distinction for pending verifications — that was invented for the UI shape, not backed by anything in the docs. Don't treat it as a real requirement if this gets rebuilt.

Bottom line: don't rebuild the Verifications tab until the trigger/effect of `is_verified` is nailed down — probably worth a quick grep of `spacesnap-api` (`UserController@pendingVerifications`) to see what actually populates that pending list, since the frontend-facing docs don't say.
Sign-out is still unwired in both UserNavbar.tsx and SupplierNavbar.tsx — same gap as the old app (buttons present, never call clearSession()).
Notifications page doesn't exist as a route, only the NotificationsPanel dropdown component — matches old app structure where /notifications was a page but this port hasn't built it yet.
The old app's known admin red/orange color never got tokenized (hardcoded arbitrary hex values). Worth a quick check that this rewrite's from-admin-red-start to-admin-orange-end classes are real theme tokens and didn't reintroduce that gap.



**Checklist before moving to Sprint 2:**
- [ ] Every page renders with mock/static data, no console errors
- [ ] TypeScript strict mode on, no `any` left in shared components
- [ ] Visual diff against old Vite build — confirm no unintentional design drift

---

## Sprint 2: Database (Prisma + PostgreSQL)

- [ ] Prisma schema: users, suppliers, spaces, credentials, training_records, bookings, transactions, certificates (with pending/approved/rejected states)
- [ ] Exclusion constraint on `bookings` to prevent overlapping time slots (Prisma doesn't support this natively — needs raw SQL migration)
- [ ] CHECK constraints for credential-gating rules
- [ ] `is_verified` boolean on users (admin-review concept — kept distinct from any auth-provider email verification flag)
- [ ] Foreign keys across all tables
- [ ] Seed script with test/mock data
- [ ] Manual test: overlapping booking rejected at DB level

**Checklist before moving to Sprint 3:**
- [ ] Constraint tests written and passing, not just "assumed to work like Laravel version"
- [ ] Schema reviewed against old Laravel schema for parity — nothing silently dropped

---

## Sprint 3: Backend API + Auth

- [ ] Auth implementation per Sprint 0 decision (register/login/logout, User and Supplier roles)
- [ ] Session/cookie handling verified across SSR and client boundaries (this is the highest-risk item in the whole rewrite — see note below)
- [ ] CRUD endpoints: spaces, credentials, bookings, certificates
- [ ] Certificate request/approval flow: supplier submits request → system_admin approve/reject before entering pool (mirrors current backend routes)
- [ ] System Admin scope: view all platform users with role, suspend/reinstate any user platform-wide
- [ ] Connect all Sprint 1 pages to real endpoints (replace mock data)
- [ ] React Query wired for data fetching/caching

**⚠️ Auth note:** Sanctum's SPA cookie auth is simple because it's pure client-side. NextAuth/JWT with SSR introduces CSRF and cookie-scope edge cases that don't exist in the old stack. Don't treat this as "same auth, different library" — budget explicit review time here.

**Checklist before moving to Sprint 3.5:**
- [ ] Auth tested across: fresh login, session refresh, logout, expired session, concurrent tabs
- [ ] CORS/cookie behavior confirmed in a deployed (not just localhost) environment

---

## Sprint 3.5: Booking & Credit Money Flow — Built Correctly From Day 1

This is the sprint that didn't exist as its own thing in the original build — it was a bug-fix pass discovered late, via a dedicated data integrity audit. This time, build it right the first time as part of core CRUD, not as an afterthought.

**Known gaps to close (do not recreate these):**
- [ ] Booking creation: check `credit_balance`, deduct credits, create a debit Transaction record, all wrapped in a single DB transaction with the Booking create — not two separate operations
- [ ] Booking confirm: creates a Transaction record (the original build never wired this — booking confirm silently deducted credits with no audit trail)
- [ ] Booking decline: refund path creates a credit Transaction record correctly
- [ ] Bulk order: pricing field on bulk_order_requests (cost = credits_per_unit × quantity), same balance-check + Transaction pattern as booking
- [ ] `type: purchase` transactions actually created by app code, not only ever seeded for demos

**Checklist before moving to Sprint 4:**
- [ ] Every credit-affecting action (book, confirm, decline, bulk order, top-up) has a corresponding Transaction record — verify this by querying the DB directly after each action, not just checking the UI updated
- [ ] `.env.testing` + isolated test DB set up from the start (the old build didn't have this until Sprint 3.5 — don't repeat that gap)

---

## Sprint 4: Core Logic

- [ ] Credential-gating: booking blocked without valid, non-expired credential
- [ ] Tier logic: achieved tier per equipment class only increases; higher tier satisfies lower requirement; booking flow compares achieved vs. required and surfaces only the delta
- [ ] Booking validation: double-booking prevention enforced end-to-end (not just at DB constraint level — surface a clean error in the UI too)
- [ ] Training/credentialing flow: submit, review, pass/fail, issue credential

**Checklist before moving to Sprint 5:**
- [ ] Tier comparison logic unit-tested with edge cases (equal tier, higher tier, no credential, expired credential)
- [ ] Double-booking attempt produces a clean user-facing error, not a raw DB constraint error

---

## Sprint 5: Kiosk/Middleware API

- [ ] Separate API surface for kiosk hardware auth
- [ ] Coordinate scope with the funded POC middleware work — this API surface must stay consistent with the Trust Architecture principle (Pi decides locally; this API only ever supplies credential facts, never an authorization verdict)

**Checklist before moving to Sprint 6:**
- [ ] Confirmed with middleware spec (v1.3) that no endpoint here could be mistaken for or misused as an authorization decision endpoint

---

## Sprint 6: Payments

- [ ] Stripe integration (user-to-supplier payments, platform fee)
- [ ] ⚠️ Developer review required before going live — financial/compliance risk, same flag as the original plan

**Checklist before moving to Sprint 7:**
- [ ] Stripe webhook tested in sandbox for all states: success, failure, refund
- [ ] No live payment code merged without a second reviewer

---

## Sprint 7: Dashboard, Polish, and Full Re-Verification

- [ ] Supplier dashboard: manage spaces, view bookings, access logs
- [ ] Notifications: booking confirmations, credential expiry alerts, access events
- [ ] Final responsive/polish pass
- [ ] **Re-run the full PreUAT checklist against the new stack** — every item that passed on the old Bubble/Laravel build gets re-verified here, not assumed carried over
- [ ] Financials/audit-trail spot check: confirm revenue-by-operator figures are complete now that the transaction gaps from Sprint 3.5 are closed

**Checklist before calling this production-ready for the LSI pilot:**
- [ ] Full PreUAT checklist passed on new stack
- [ ] Side-by-side smoke test against old build for any page where behavior differs
- [ ] Old Laravel/Vite build kept live and untouched as fallback until new stack has run cleanly for a defined period (your call on how long)

---

## Notes

- This plan assumes a full-stack rewrite (frontend + backend + auth), not a frontend-only swap onto the existing Laravel API.
- The biggest real risk in this rewrite is not "will Claude Code generate the code" — it's re-verifying auth and money-flow correctness that took a dedicated audit to catch the first time.
- Keep a SPRINT_PLAN.md-equivalent (this file) in the new repo root for Claude Code session context, same convention as before.

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
- [x] Every page renders with mock/static data, no console errors
- [x] TypeScript strict mode on, no `any` left in shared components
- [x] Visual diff against old Vite build — confirm no unintentional design drift

---

## Sprint 2: Database (Prisma + PostgreSQL)

- [x] Prisma schema: users, suppliers, spaces, credentials, training_records, bookings, transactions, certificates (with pending/approved/rejected states)
- [x] Exclusion constraint on `bookings` to prevent overlapping time slots (Prisma doesn't support this natively — needs raw SQL migration)
- [x] CHECK constraints for listing pricing rules (space/equipment vs. consumables)
- [ ] `is_verified` boolean on users (admin-review concept — kept distinct from any auth-provider email verification flag) — deliberately not added yet, see Sprint 1 notes above on undefined trigger/effect
- [x] Foreign keys across all tables
- [x] Seed script with test/mock data
- [x] Manual test: overlapping booking rejected at DB level (`23P01` exclusion violation confirmed via raw SQL insert)

**Checklist before moving to Sprint 3:**
- [x] Constraint tests written and passing, not just "assumed to work like Laravel version"
- [x] Schema reviewed against old Laravel schema for parity — nothing silently dropped

---

## Sprint 3: Backend API + Auth

- [x] Auth implementation per Sprint 0 decision (register/login/logout, User and Supplier roles)
- [x] Session/cookie handling verified across SSR and client boundaries (this is the highest-risk item in the whole rewrite — see note below) — mechanism confirmed correct in Session 2; the route-protection gap it surfaced is tracked as its own Sprint 4 item below, not a blocker on this line item
- [x] CRUD endpoints: spaces, credentials, bookings, certificates — credentials write access and bookings' credit ledger are intentionally partial, see Session 3/4 notes above and Sprint 3.5 below
- [x] Certificate request/approval flow: supplier submits request → system_admin approve/reject before entering pool (mirrors current backend routes)
- [x] System Admin scope: view all platform users with role, suspend/reinstate any user platform-wide
- [x] Connect all Sprint 1 pages to real endpoints (replace mock data) — done 2026-07-19: every page/component listed under Sprint 4.5 is now wired to a real route (marketplace/BookingModal/RequestPurchaseModal, passport, wallet/TopUpCreditsModal, user dashboard, supplier inventory/AddEditListingModal, supplier requests, supplier analytics/profile, admin users/companies, admin approvals, admin certificates & training). `npm test`, `tsc --noEmit`, `eslint .`, and `next build` all clean.
- [x] React Query wired for data fetching/caching — done alongside the above; every page above now uses a `lib/hooks/use*.ts` React Query hook (`useListings`, `useCredentials`, `useWallet`, `useCurrentUser`, `useCertificateCatalog`, `useSupplierListings`, `useSupplierBookings`, `useSupplierCertificates`, `useAdminUsers`, `useAdminCertificates`, `useUserBookings`), not just the login/signup mutations from before.

**Correction, same day:** the first pass of this item deleted `CreateSessionModal`, `ViewNamelistModal`, `QuizBuilderStep`, `UploadVideoModal`, `TrainingVideoModal`, `RatingDisplay`, and `RatingStars` (plus `lib/mock*.ts` files, including `mockTutorials.ts`) on the reasoning "no backend route exists yet." That's not a valid deletion reason on its own — the old Laravel API has working `TrainingVideoController`/`QuizQuestionController`/`TrainingSessionController` endpoints this stack just hasn't ported yet (a real, separately-tracked gap, not evidence the feature is unneeded). **Standing rule going forward: only delete a component when it's superseded by an equivalent replacement doing the same job (a mock file replaced by a real API call is normal cleanup) — never just because its backend doesn't exist yet in this stack.** All 5 training components + `mockTutorials.ts` were restored, left on mock data, each with a one-line TODO noting the specific old controller it's waiting on. The supplier Tutorials page and the admin Certificates & Training "Training Videos" tab are both back to their original mock-wired UI.

**Small backend additions made along the way** (same spirit as exposing an existing column, not new business logic): `serializeListing` now includes `companyName` (added a `company` include); `serializeCertificate` now includes `earningMethod` (column existed, was never returned); `serializeBooking` now includes `userTitle`; new `GET /api/wallet` (balance + transaction history — only `POST /topup` existed before), new `GET /api/me` (profile fields the JWT session doesn't carry), and new `GET /api/bookings` (the caller's own bookings — needed for the ratings feature below, closing the "no GET to list a user's own bookings" gap as a side effect). Also fixed a real bug found in the process: consumable listings were routed through `BookingModal`/`POST /api/bookings`, which 422s on consumables by design — both "Buy Now" and "Request Purchase" now correctly go through `RequestPurchaseModal`/`POST /api/bulk-order-requests`.

**New feature, same day — booking ratings:** unlike everything else in this sprint, this has no old-Laravel equivalent to port; it's new scope, requested and specced by the product owner directly (not from a design doc — this project has no rating/review spec on file). New `Rating` model/migration (`20260719144817_add_ratings`): one row per booking (`booking_id` unique — a user re-booking the same listing can rate each stay separately), `listing_id` denormalized off the booking for cheap aggregates, `score` 1-5 enforced by both app validation and a `ratings_score_range` DB CHECK constraint (matching this project's convention of enforcing domain rules at the DB level, not just app-layer), optional `comment`, not editable after submit (no PATCH route — resubmitting hits `RatingAlreadyExistsError`, a 422). `POST /api/bookings/[id]/rating` validates the booking belongs to the caller and is `completed` before accepting. `GET /api/listings` and `.../[id]` now return `averageRating`/`ratingCount` per listing (bulk `groupBy` aggregate, not one query per card). Frontend: the user dashboard's Recent Activity card lists real bookings and shows a `RatingStars` input for unrated completed ones (read-only star display, via a new `readOnly` prop on that component, once rated); the marketplace shows `RatingDisplay` (avg + count) on cards and the map detail panel, for space/equipment listings only — consumables can't be booked so can never be rated. Covered by `lib/ratings.test.ts` (7 tests: field validation, ownership/status/duplicate rejection, the DB CHECK constraint, and the aggregate query), registered in `npm test`.

**Backend gaps found and deliberately left unwired** (stubbed in the UI with a note, not built — flagged here per-item rather than guessed at):
- No `GET` to list active check-ins (only `POST` create + `PATCH` check-out exist) — user dashboard's "Currently Active" card.
- `activity_log` has no API route at all (write-only from server lib code) — same gap Sprint 4.5 already tracked; the user dashboard's "Recent Activity" card now shows real bookings instead (see the ratings feature above), not the generic activity_log feed.
- No `GET /api/admin/companies` (nested supplier data) — admin Users & Companies page.
- No admin-level booking-approval concept, and no `GET/PATCH /api/admin/promotions` (the `promotionRequested` column exists on `users`, nothing reads/writes it) — admin Approvals page, and the supplier profile "Request Promotion" button.
- No admin-wide aggregation endpoint for total companies, cross-supplier bookings, or platform/per-operator revenue (`transactions` is keyed by user, not company) — admin Platform Overview + Platform Financials pages, supplier Analytics revenue chart.
- No route exposing `TrainingVideo` (list/create/edit/delete) or video-completion tracking; no route listing `TrainingSession`s or a session's enrolled participants (`training_enrollments` only has `POST` enroll + `PATCH` status-by-id); quiz questions and SME sign-off have no backing model — supplier Tutorials page and the admin Certificates & Training "Training Videos" tab (same gap, both places; both intentionally left on mock data per the correction above, not stubbed).
- No `Invoice`/`Receipt`/payout concept in the schema (Sprint 6's Stripe integration is unbuilt) — supplier profile's Accounts Receivable / Receipts & Invoices cards.
- No route exposing `Company` business fields (business name/location/contact email exist on the model; registration number and finance-contact-person don't exist at all) for editing — supplier profile Business Details card.

These are candidates for a dedicated CRUD pass (new Session 3/4-style work, porting the old TrainingVideoController/QuizQuestionController/TrainingSessionController) or explicit sprint-plan tracking, at the product owner's call — not guessed at or built here.

**⚠️ Auth note:** Sanctum's SPA cookie auth is simple because it's pure client-side. NextAuth/JWT with SSR introduces CSRF and cookie-scope edge cases that don't exist in the old stack. Don't treat this as "same auth, different library" — budget explicit review time here.

**Checklist before moving to Sprint 3.5:**
- [x] Auth tested across: fresh login, session refresh, logout, expired session, concurrent tabs
- [ ] CORS/cookie behavior confirmed in a deployed (not just localhost) environment

---

## Sprint 3.5: Booking & Credit Money Flow — Built Correctly From Day 1

This is the sprint that didn't exist as its own thing in the original build — it was a bug-fix pass discovered late, via a dedicated data integrity audit. This time, build it right the first time as part of core CRUD, not as an afterthought.

**Known gaps to close (do not recreate these):**
- [x] Booking creation: check `credit_balance`, deduct credits, create a debit Transaction record, all wrapped in a single DB transaction with the Booking create — not two separate operations
- [x] Booking confirm: creates a Transaction record (the original build never wired this — booking confirm silently deducted credits with no audit trail)
- [x] Booking decline: refund path creates a credit Transaction record correctly
- [x] Bulk order: pricing field on bulk_order_requests (cost = credits_per_unit × quantity), same balance-check + Transaction pattern as booking
- [x] `type: purchase` transactions actually created by app code, not only ever seeded for demos — closed by the bulk-order debit above (`createBulkOrderWithDebit`); `type: topup` was the actual remaining gap (see wallet item below), not `purchase`, per the correction in CLAUDE1.md Known Gap #5

**New schema items (not fixes to the above — tables with no home in this plan until the parity audit):**
- [x] `check_ins` table (user_id, listing_id, booking_id nullable, checked_in_at, checked_out_at nullable) — the old app never had a working controller for this (table/model/factory existed, no route). This sprint should decide whether check-in updates booking status, previously unresolved/unconfirmed in the old codebase. **Decided (confirmed with product owner):** yes — check-in flips `confirmed`→`active`, check-out flips `active`→`completed`; see CLAUDE1.md "Sprint 3.5, New Schema Item — `check_ins` Table + Controller."
  - **Revisit later:** what happens if the user never checks in — a no-show? Nothing currently transitions a `confirmed` booking off that status if check-in never happens; it stays `confirmed` forever (or until decline). No detection, no timeout, no automatic cancel/forfeit. Undecided: does a no-show forfeit credits, get auto-declined/refunded after some grace window, or just sit stale? Not guessed at here — needs its own product decision before building, same as the check-in-updates-status question above.
- [x] `activity_log` table (user_id, action_type, description, related_listing_id nullable) — schema + write-path hooked into booking create/confirm/decline, bulk order, top-up, and check-in/out (see CLAUDE1.md "Sprint 3.5, New Schema Item — `activity_log` Table + Write-Path Hooks"). No feed UI yet.
- [x] `training_enrollments` table (user_id, training_session_id, status enum enrolled/awaiting_signoff/completed/cancelled, unique on the pair) — backs the training session "enrolled participants" list, a real feature not previously scoped into this rewrite plan. `POST /api/training-enrollments` (enroll) + `PATCH /api/training-enrollments/[id]` (supplier status update, `enrolled` unreachable as a target) — see CLAUDE1.md "Sprint 3.5, New Schema Item — `training_enrollments` Table + Enroll/Status-Update Endpoints."

**Checklist before moving to Sprint 4:**
- [x] Every credit-affecting action (book, confirm, decline, bulk order, top-up) has a corresponding Transaction record — re-verified end-to-end 2026-07-19 by performing each action live against the dev server/DB and querying `transactions` directly after each: booking create (debit row), confirm (zero-amount audit row), decline (refund row, balance restored exactly), bulk order (purchase row, cost = price_per_unit × quantity confirmed exact), top-up (topup row). All test rows deleted afterward, dev DB confirmed back to seeded state (`transactions`/`bookings` row counts unchanged). See CLAUDE1.md "Sprint 3.5, End-to-End Re-Verification" for the full transcript.
- [x] `.env.testing` + isolated test DB set up from the start (the old build didn't have this until Sprint 3.5 — don't repeat that gap) — re-confirmed 2026-07-19 by snapshotting `spacesnap_dev` row counts, running `npm test` (60 tests, real DB writes/deletes), and confirming the dev DB counts were byte-identical before/after while the isolated `spacesnap_nextjs_test` DB is what the suite actually exercises. Not just set up once and abandoned — every Sprint 3.5 session's "Tests:" section (Known Gaps #1–5, check_ins, activity_log, training_enrollments) added cases to this same suite and it still runs clean.

---

## Sprint 4: Core Logic

- [x] Credential-gating: booking blocked without valid, non-expired credential — existence+expiry check was already built in Sprint 3 Session 4 (`missingCertificateIds`, `lib/bookings.ts`); this item re-verified it live against seeded data, no code changes needed. Schema has no `tier` concept at all (confirmed by grep) — out of scope here per item 2, not silently dropped
- [ ] Tier logic — **SCRAPPED, redesigned as certificate-set gating.** The original item 2 design (achieved tier per equipment class only increases; higher tier satisfies lower requirement) was built (`lib/tiers.ts`) on a wrong assumption. Confirmed with the product owner: there is no numeric tier progression — "tier" is just a label for *how* a certificate was earned (self-serve video/quiz vs. operator sign-off vs. operator-or-SME sign-off), not a level of achievement. Every path produces the same `user_certificates` row. `lib/tiers.ts`/`lib/tiers.test.ts` deleted; replaced by a plain set-difference module, `lib/certificate-gating.ts` (`getMissingCertificates`), wired into `missingCertificateIds` in `lib/bookings.ts`. See CLAUDE1.md "Sprint 4, Item 2 (revised)" session note for the full pivot writeup. Leaving this line unchecked because the *product-facing* tier concept (whatever UI/flow eventually surfaces `earning_method` to users) is still undefined — the gating mechanism itself is done and tested.
- [x] `certificates.earning_method` enum column added (`tier1_video_quiz` / `tier2a_operator_signoff` / `tier2b_operator_or_sme_signoff`), via a real migration (`prisma/migrations/20260719064218_add_certificate_earning_method`), kept distinct from the existing `certificates.category` column per the "don't conflate the two" note in CODEBASE_SUMMARY.md.
- [x] Booking validation: double-booking prevention enforced end-to-end — app-layer pre-check (`hasOverlappingBooking`, `lib/bookings.ts`) added ahead of the insert, plus the existing DB-constraint 23P01 catch now shares the identical clean message for the race window. See CLAUDE1.md "Sprint 4, Item 3" session note.
- [ ] Training/credentialing flow: submit, review, pass/fail, issue credential
- [ ] **Close the route-protection gap found in the Sprint 3 Session 2 session/cookie
      review (see `CLAUDE1.md`, "Sprint 3, Session 2" section, 2026-07-19):
      there is currently no server-side route protection anywhere** — no
      `middleware.ts`, no `auth()` call in any Server Component/layout, no
      `redirect()` guard. Confirmed live: with zero session cookie,
      `/admin/dashboard` and `/supplier` render their full pages to an
      anonymous request; only the navbar differs by route group, nothing
      actually checks the caller. Fix by adding `middleware.ts` (or
      per-layout `auth()` + `redirect()`) gating `(user)`, `(supplier)`, and
      `(admin)` route groups by the matching `isSupplier`/`isCompanyAdmin`/
      `isSystemAdmin` flag. This is the last item in Sprint 4 specifically so
      it closes right before Sprint 5's kiosk/middleware work builds on top
      of a trust boundary that actually holds.

**Checklist before moving to Sprint 5:**
- [x] Certificate-set gating unit-tested with edge cases (holds all, missing one of several, holds none, expired treated as missing, no certs required) — 7 tests, `lib/certificate-gating.test.ts`, run via `npm test`. Supersedes the earlier "tier comparison logic" line item — see scrapped-tier note above.
- [x] Double-booking attempt produces a clean user-facing error, not a raw DB constraint error

---

## Sprint 4.5: Wire the Backend to the Frontend — Close the Mock-Data Gap

Found via a linkage audit (2026-07-19): every page still reads from `lib/mock*.ts`, and the gap is wider than the still-unchecked Sprint 3 item accounts for. That item assumes reconnecting pages that already exist; it doesn't cover Sprint 3.5 features that never had a page scoped for them in the first place, or the one new table with no route at all. Closing both together here instead of leaving them split across "Sprint 3 leftover" and "new scope no one wrote down."

- [ ] Connect all Sprint 1 pages to their real endpoints (completes the still-unchecked Sprint 3 item) — replace `lib/mock*.ts` usage in marketplace, passport, wallet, user dashboard, supplier inventory/requests/tutorials/profile, and all admin pages with live fetches against: `listings`, `bookings`, `supplier/bookings`, `supplier/listings`, `credentials`, `certificates`, `admin/certificates`, `admin/users`
- [ ] React Query actually adopted for these fetches (installed app-wide, currently only used for the login/signup mutations)
- [ ] Build UI for check-ins (check-in/check-out action) — no page was ever scoped for this; `POST /api/check-ins` and `PATCH /api/check-ins/[id]/check-out` exist with zero callers
- [ ] Build UI for training-enrollments (enroll button + supplier-side status update) — `POST /api/training-enrollments` and `PATCH /api/training-enrollments/[id]` exist with zero callers
- [ ] Build UI for bulk-order-requests — `POST /api/bulk-order-requests` exists with zero callers
- [ ] Add an `activity_log` read endpoint (GET) — currently write-only from server-side lib code (`lib/bookings.ts`, `lib/check-ins.ts`, `lib/bulk-orders.ts`, `lib/training-enrollments.ts`, `lib/wallet.ts`); no route exists at all, which is why Sprint 3.5's "no feed UI yet" note has stayed unresolved
- [ ] Decide + build (or explicitly defer with a reason) an activity feed UI once the read endpoint exists

**Checklist before moving to Sprint 5:**
- [ ] Zero remaining `lib/mock*.ts` imports in page components
- [ ] Every Sprint 3.5 endpoint (check-ins, training-enrollments, bulk-order-requests, wallet top-up, certificates + admin/supplier certificate routes) has at least one real frontend caller, or is explicitly marked deferred with a reason

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

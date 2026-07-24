# Audit & Leftover Sprint Items

**Status:** Live tracking doc, replaces `SPRINT_PLAN_NEXTJS_REWRITE.md` going forward.
**Created:** 2026-07-24, from a pre-UAT audit of user- and supplier-facing pages (marketplace, financials/wallet, dashboard, passport; supplier analytics, inventory, requests, profile, financials, tutorials) plus every unchecked item still open in the old sprint plan.

`SPRINT_PLAN_NEXTJS_REWRITE.md` and `CLAUDE1.md` are now frozen historical records — useful for "why was it built this way," not for "what's left to do." This doc is the single source of truth for outstanding work from here on. New findings/gaps get added here, not back into the sprint plan.

---

## Part 1 — Audit Findings (2026-07-24)

Findings from a live click-through (real dev DB, `ethan@example.com` as member, `ben@acmecoworking.sg` as supplier) plus a static grep pass over every in-scope page/component. Scope was user-facing (Marketplace, Digital Passport, Financials/Wallet, Dashboard) and supplier-facing (Analytics, Inventory, Requests, Profile, Financials, Tutorials) pages — landing page, marketing sub-pages, and admin pages excluded.

### 🔴 High severity — fakes a completed action

- [x] **Marketplace "Submit Membership Inquiry" / "Request Consultation" fake-succeeds.** ~~`components/CustomRequirementsModal.tsx` — submitting fires **zero network requests** (confirmed via live network trace), yet shows *"Request Sent — our team will review your request..."*. A TODO in the code already acknowledges no backend exists (`handleSubmit` only does `setSubmitted(true)`). Fix: either wire a real endpoint, or change the copy to an honest "not available yet" rather than a fabricated confirmation.~~ **Fixed 2026-07-24**: real backend built — `MarketplaceEnquiry` model, `POST /api/marketplace-enquiries` (user submit), `GET`/`PATCH /api/admin/marketplace-enquiries` (admin queue + resolve). New "Pending Enquiries from Marketplace" row on the Admin Overview page opens a review modal (requester name/email/company, details, "Mark Fulfilled" button); enquiries are handled out-of-platform per product decision. Verified live end-to-end (submit → real DB row → admin queue → mark fulfilled → disappears from pending) plus 6 passing unit tests (`lib/marketplace-enquiries.test.ts`).
- [x] **Digital Passport "Edit Profile" doesn't save.** ~~`app/(user)/passport/page.tsx` — confirmed live: changed name, clicked Save, UI updated, reload reverted it. No `fetch`/mutation exists in the save path at all (`handleToggleEdit` only flips local state).~~ **Fixed 2026-07-24**: wired to a new `PATCH /api/me` (backed by `lib/user-profile.ts`), invalidates the `me` query on success. Verified live: name change survives a hard reload.
- [x] **Supplier Profile "Edit Profile" has the same bug, no disclosure.** ~~`app/(supplier)/supplier-profile/page.tsx` — identical dead toggle (`nameEdit`/`titleEdit`/`avatarEdit` never sent anywhere). Inconsistent with `BusinessDetailsCard` on the same page, which is wired correctly via `useUpdateSupplierCompany`.~~ **Fixed 2026-07-24**: same `PATCH /api/me` endpoint reused (shared `useUpdateProfile` hook); added the missing Save/Cancel pair (previously only a single toggle button existed). Verified live: name change survives a hard reload.

### 🟠 Medium severity — silently dropped data / stale copy

- [x] **Supplier decline-reason captured but never sent (bookings).** ~~`app/(supplier)/supplier-requests/page.tsx` / `lib/hooks/useSupplierBookings.ts` — `DeclineReasonModal` correctly captures a reason, but `useDeclineBooking`'s mutation sends no body. The backend route (`app/api/supplier/bookings/[id]/decline/route.ts`) already accepts `reason` — this is a pure frontend gap, quick fix.~~ **Fixed 2026-07-24**: `useDeclineBooking` now sends `{ reason }`, and `handleDeclineConfirm` passes the modal's reason through. Verified live end-to-end (declined a booking with a reason → confirmed `cancellation_reason` persisted in the DB).
- [x] **Same gap on bulk-order decline, but deeper.** ~~`handleDeclineBulkOrderConfirm` / `useDeclineBulkOrder` (`lib/hooks/useSupplierBulkOrders.ts`) — here the backend route (`app/api/supplier/bulk-order-requests/[id]/decline/route.ts`) doesn't accept a reason at all, so this needs a backend change too, not just a frontend fix.~~ **Fixed 2026-07-24**: added a new `BulkOrderRequest.declineReason` column (separate from the buyer-authored `cancellationReason` field used by the cancellation-request flow), migration applied, `declineBulkOrder` now persists it, the decline route accepts `reason` in the body, and the frontend hook/page wire it through. Verified live end-to-end (declined a bulk order with a reason → confirmed `decline_reason` persisted in the DB) plus a new passing unit test.
- [x] **Stale/misleading copy in three places** — reads like a leaked internal dev note instead of product copy:
  - ~~User Dashboard "Currently Active" card: *"Not wired yet — there's no GET endpoint to list active check-ins... Tracked as a backend gap."*~~ **Fixed 2026-07-24**: now reads "Coming soon — live check-in status will appear here once kiosk check-in is rolled out."
  - ~~Supplier Financials "Accounts Receivable, Receipts & Invoices" card: same pattern, verbatim engineering language.~~ **Fixed 2026-07-24**: now reads "Coming soon — invoice and receipt management will appear here in a future release."
  - ~~Wallet "Payment Methods" card: *"Stripe integration is planned for Sprint 6"* — false as written; Stripe is already live for booking charges (verified: Stripe Elements card iframe loads correctly with a real publishable key in the booking modal). The card really means "no saved-card management for wallet top-ups," but as worded it implies Stripe isn't integrated anywhere, which will confuse a UAT tester.~~ **Fixed 2026-07-24**: now reads "Saved-card management is coming soon. Top-ups are credits-only for now — for bookings, you can already pay by card at checkout."
  - Verified all three live in-browser (as both member and supplier sessions).

### 🟡 Low severity / confirmed-accurate known gaps (not new, just re-verified)

- [ ] No `/notifications` page route exists (confirmed 404) — only the navbar dropdown panel. Not a bug, just still not built.
- [ ] "Currently Active" card has no backend (`GET` to list active check-ins doesn't exist, only `POST` create / `PATCH` check-out) — the copy issue above is separate from this; the underlying feature gap is real and intentionally deferred to kiosk/Sprint 5 work.
- [ ] All listing images render as broken/placeholder icons (Marketplace, Supplier Inventory, Profile) — expected, R2 isn't configured in this dev environment. Needs real R2 credentials before any real visual UAT pass, otherwise every listing looks broken to a tester.
- [ ] BuyerOrganization pooled "purchased credits" has no spend write-path yet — schema exists (`Transaction.buyerOrganizationId`), but no checkout UI lets a member choose personal vs. org funds.
- [ ] Lab Digest / Ads / Newsletter cards on Supplier Profile — explicitly labeled "Coming soon," confirmed intentional, not a bug.
- [ ] `lib/mockTutorials.ts`'s `VIDEO_CATEGORIES` populates two real rendered UI lists (filter pills + upload `<select>`) — technically "mock" file, but it's a legitimate fixed enum matching `TrainingVideo.category`, not fake content. Low-priority hygiene: move the constant out of a `mock*.ts`-named file so it stops looking like a flagged item.
- [ ] Marketplace map view uses a hardcoded `MAP_PIN_POSITIONS` array for pin layout (real listing data, fake/looping positions) — honestly labeled on-screen as "Sample map preview." Cosmetic only.

### ✅ Confirmed fixed (sprint-plan doc was stale — do not re-flag these)

- Sign-out works correctly on both navbars (`UserNavbar.tsx`/`SupplierNavbar.tsx` both call real `signOut()`) — session confirmed fully cleared live. The old sprint plan's Sprint 1 note calling this unwired is stale.
- Booking/purchase/bulk-order/cancel/modify modals (`BookingModal`, `RequestPurchaseModal`, `CancelBookingModal`, `ModifyBookingModal`, `RequestCancellationModal`, `ConfirmBulkOrderModal`, `CancellationReviewModal`) all call real mutations.
- `BuyerOrganizationCard`/`ManageBuyerOrganizationModal`/`OrgSearchInput` — fully wired; closes the original Sprint 7.1 trigger bug (signup's dead `company`/`role` fields).
- `RoleGuard.tsx` — member/supplier exclusivity genuinely enforced client-side, matching the server-side `proxy.ts` gate.
- Analytics, Inventory, Requests, Tutorials, Financials (supplier) pages all load cleanly with real data, no console errors, no failed API calls, across both a member and a supplier session.

---

## Part 2 — Leftover Items from the Old Sprint Plan

Pulled from every remaining unchecked `[ ]` box in `SPRINT_PLAN_NEXTJS_REWRITE.md`, deduplicated and reorganized by risk/theme (not sprint number). Where a parent line was unchecked but its sub-items had already closed, only the genuinely-still-open piece is listed.

### Payments & Compliance (highest risk — financial/legal, needs a second reviewer)

- [ ] ⚠️ Developer review required before going live on Stripe — financial/compliance risk (Sprint 6).
- [ ] No live payment code merged without a second reviewer (Sprint 6 checklist).
- [ ] One real booking's Stripe charge + webhook round-trip verified against a **deployed** URL, not just `stripe listen` on localhost (Sprint 6.11). Note: the Stripe Elements card field loads correctly and charge-on-create/webhooks/refunds are code-complete per the old plan — this is the one remaining "run it for real once" step before sign-off.
- [ ] "Credits" cosmetic-unit ToS clarification section still needs to be written into an actual Terms of Service document/page (flagged in old Sprint 7, never drafted) — the exact wording was already drafted in the sprint plan and just needs a home.
- [ ] **No commission breakdown ledger — SpaceSnap's own cut is computed and discarded, never stored.** `createCompletedBookingPayable` (`lib/supplier-payables.ts`) computes `commissionAmount = sgdAmount * platformCommissionPercent` purely to derive `SupplierPayable.grossAmount` (`sgdAmount - commissionAmount`) — the commission figure itself is never persisted anywhere, so there's no row-level record of what SpaceSnap actually kept per booking. 2026-07-24: built the `SupplierPayout` model (batches a company's pending `SupplierPayable` rows into a period, admin pastes a Xero Bill URL when billed / Remittance Advice URL when paid — admin Financials "Supplier Payouts" card, supplier Financials "Accounts Receivable, Receipts & Invoices" card) to close the old "Invoice/Receipt gap," but it only shows the supplier's payout total. Still missing: a three-way reconciliation (gross collected from members → commission SpaceSnap kept → net paid to supplier), per payout batch and platform-wide, that an admin can check *before* the manual Xero Bill step. Needs a `commissionAmount` column on `SupplierPayable` (or an equivalent derivation) plus an admin UI surfacing the breakdown. No real Xero API connection exists either way (no Xero Developer app/credentials registered as of 2026-07-24) — today's whole payout flow, including this future reconciliation view, stays admin-managed/manual-entry until that exists.
- [ ] **Full audit of money movement needed, end to end — this is the product owner's main revenue and has to produce auditable statements.** Raised 2026-07-24 directly in response to the commission-ledger gap above. Scope: trace every dollar through the whole pipeline — member's Stripe charge → platform commission taken → `SupplierPayable`/`SupplierPayout` batch → manual Xero Bill/Remittance today (real Xero API sync later) — and confirm at each hop that the money is fully accounted for and reconcilable (nothing created or destroyed between stages, every credit-denominated figure traceable back to its true-SGD source per the `lib/credit-units.ts` convention). Distinct from the commission-ledger item above: that one is "store the commission figure"; this one is "verify the whole chain reconciles and produce statements an auditor could check," which is a bigger review, likely wants a second reviewer given the "Payments & Compliance" risk tier this section is already flagged at. Not started — no design decisions made yet on what the audit method or the statement format should look like.

### Deployment Readiness (blocks a real go-live, Sprint 6.11)

- [ ] A real deploy exists at a Railway URL, logged into successfully.
- [ ] CORS/cookie behavior confirmed in a deployed (not just localhost) environment.
- [ ] R2 bucket CORS configuration for the production bucket.
- [ ] Separate R2 bucket + credentials for production (distinct from the dev `spacesnap-dev` bucket).
- [ ] Stripe webhook endpoint pointed at the real Railway URL, with a real (non-`stripe listen`) signing secret set as `STRIPE_WEBHOOK_SECRET`.
- [ ] Railway Cron Schedule service provisioned for `/api/cron/resolve-pending-booking-credits` (currently only a lazy read-time sweep covers this).
- [ ] Railway environment variables set from real production values (`DATABASE_URL`, fresh `AUTH_SECRET`, `R2_*`, Stripe keys, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`) — not copied from local `.env`.
- [ ] Confirm Railway's managed Postgres connection-pool/`sslmode` behavior under Prisma, especially across container restarts/redeploys — not yet verified against a real Railway Postgres instance.
- [ ] `output: 'standalone'` in `next.config` — optional (smaller/faster build), not a blocker.

### Kiosk / Middleware (Sprint 5 — separate hardware track, not started)

- [ ] Separate API surface for kiosk hardware auth.
- [ ] Coordinate scope with the funded POC middleware work (Trust Architecture: Pi decides locally, this API only ever supplies credential facts, never an authorization verdict).
- [ ] Confirm with middleware spec (v1.3) that no endpoint here could be mistaken for/misused as an authorization decision endpoint.
- [ ] Check-ins UI is explicitly **not** to be built browser-side per the kiosk Trust Architecture — a `CheckIn` must only ever be written by the physical kiosk's Pi after a local credential match + card dispense. This is the root cause of the Dashboard's "Currently Active" gap above — don't build a browser workaround for it.

### Deferred-by-design feature gaps (product decisions, not bugs)

- [ ] **Gigs** — schema landed (`GigTask`/`GigAssignment`), no write path, no UI. Explicitly shelved twice by the product owner. Do not silently start building without re-confirming it's back in scope.
- [ ] **Product-facing "tier" concept for `earning_method`** — the gating mechanism (self-serve video/quiz vs. operator sign-off vs. operator-or-SME sign-off) is built and tested, but whether/how this is ever surfaced to users as a labeled concept is undefined.
- [ ] **`events` (Exclusive Event Invite) and `lucky_draw` (Lucky Draw Ticket)** reward-catalogue categories — explicitly deferred, product owner still deciding the events side of the business. Shape for `lucky_draw` is pre-agreed (draw on a set date) for whenever it's picked back up.
- [ ] **Personal/Others spend-attribution toggle** for the BuyerOrganization pooled credit pool — has no home yet since there's no pooled-spend write path to attribute (see the pooled-credits gap in Part 1).

### Sprint 7 — Final Polish & Re-Verification (never completed)

- [ ] Supplier dashboard: manage spaces, view bookings, access logs — largely covered today by Inventory/Requests/Analytics; worth a final check that nothing specific is still missing rather than treating this as a fresh build.
- [ ] Final responsive/polish pass across the app.
- [ ] Re-run the full PreUAT checklist against the new stack — every item that passed on the old Bubble/Laravel build re-verified here, not assumed carried over.
- [ ] Financials/audit-trail spot check — confirm revenue-by-operator figures are complete now that the Sprint 3.5 transaction gaps are closed.
- [ ] Side-by-side smoke test against the old Laravel/Vite build for any page where behavior differs.
- [ ] Old Laravel/Vite build kept live and untouched as a fallback until the new stack has run cleanly for a defined period (owner's call on how long).

### Marketing Sub-Pages (Sprint 7.12/7.13 — out of this audit's scope, listed for completeness)

- [ ] `/platform/marketplace`, `/platform/digital-passport`, `/solutions/startups`, `/solutions/space-providers`, `/solutions/suppliers` — all currently just a "coming soon" `MarketingPageShell` stub, content not written.
- [ ] 2 more `Platform` nav entries — labeled "Supplier Feature (Undecided)" ×2, still need names before routes can exist.
- [ ] 1 more `Solutions` nav entry — "For Larger Companies" (undecided), wants to market the regional-mobility angle.
- [ ] Scroll/hover/page-load transition effects across marketing pages — scope not yet defined, needs a follow-up conversation before implementation.

---

## Closed loop

This doc's Part 1 is the completion of the old sprint plan's **"Sprint 7.1: Site-Wide UI→Backend Wiring Audit"** (raised 2026-07-23, never started) — that item and its file section in `SPRINT_PLAN_NEXTJS_REWRITE.md` can now be considered done, superseded by the findings above.

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

## Part 3 — Full Money-Movement Audit (2026-07-24)

The end-to-end trace requested in Part 2 ("Full audit of money movement needed, end to end"). Static trace of every dollar through the pipeline, hop by hop, confirming reconciliation at each stage. **Headline: the write paths reconcile correctly, but the *reporting* layer (`lib/revenue.ts`) was never rewired to the split-ledger `TransactionType` values, so every revenue figure shown to admins and suppliers is wrong.**

### The pipeline, hop by hop (what actually gets written)

1. **Member pays (money in).**
   - Booking (space/equipment): full-price Stripe PaymentIntent → `Transaction` type `booking_payment` (negative). Charged *before* the DB txn opens, with a compensating Stripe refund in the catch block — atomic. ✅
   - Reschedule: Stripe charge → `booking_modification_fee` (negative). ✅
   - "Buy Now" consumables: debited from `purchasedBalance` → `purchased_spend` (negative), no Stripe (wallet-funded). ✅
   - Bulk-order fulfillment: debited → `purchase` (negative). ⚠️ see F3.
   - Wallet top-up: `purchased_topup` (positive). ⚠️ credits-only, no real Stripe charge backs it — see F4.
2. **Commission split.** `createCompletedBookingPayable` computes `commissionAmount` then discards it, storing only `grossAmount`/`netAmount`. ⚠️ see F2.
3. **Supplier payable ledger.** `SupplierPayable` rows (completion credit / decline-penalty debit / cancel zero-row), balance = live `SUM(netAmount WHERE pending)`. Coherent, nets penalties against earnings automatically. ✅
4. **Payout batch.** `SupplierPayout` snapshots the summed `netAmount`, manual Xero Bill/Remittance. Coherent. ✅
5. **Refunds.** cancel / decline-resolution / booking-credit → `refund` (positive) + real Stripe refund; `stripe-webhooks.ts` cross-checks Stripe's `amount_refunded` against the ledger. ✅
6. **Revenue reporting.** ❌ **BROKEN — see F1.**

### Findings

- [x] 🔴 **F1 (CRITICAL, confirmed) — `lib/revenue.ts` sums stale transaction types; the platform's primary revenue is invisible and refunds make revenue go negative.** ~~`REVENUE_TRANSACTION_TYPES = ["booking", "purchase", "refund"]`, but the split-ledger rewrite moved real charges to `booking_payment` (all space/equipment bookings — the main revenue stream), `purchased_spend` (all Buy Now sales), and `booking_modification_fee` (reschedule fees) — **none of which are summed**. The only sale type still counted is bulk-order `purchase`. Worse, `refund` (positive) *is* still summed and then negated, so a completed booking reports **0 revenue** and a refunded booking reports **negative** revenue. This directly breaks `revenue.ts`'s own stated invariant ("a booking that was declined contributes 0, not -amount") — that only held when the debit was type `booking`, which now only ever carries a zero-amount confirm-audit row. Affects every money figure the app shows: Admin Overview "total revenue" card, Admin Financials revenue-by-operator table + cross-company feed, and the Supplier Financials "Platform Revenue" chart. **No test coverage** (`lib/revenue.test.ts` does not exist).~~ **Fixed 2026-07-24**: added `booking_payment`, `booking_modification_fee`, and `purchased_spend` to `REVENUE_TRANSACTION_TYPES` (kept the legacy `booking`/`purchase`/`refund` types so seed/pre-transition rows and refund-netting still work; no double-counting — a live booking writes one `booking_payment` charge plus a zero-amount `booking` audit row, and earned-credit discounts stay excluded). Note on why the earlier Stripe testing masked this: `prisma/seed.ts` writes old-type `booking` rows with real amounts, so the Financials pages always showed *seed* revenue (~4200 credits) — a real Stripe charge writes `booking_payment`, which the query ignored, so the number validated came from the seed, not from the charge. Added `lib/revenue.test.ts` (6 passing DB-integration tests against real Postgres): live `booking_payment` counts, Buy Now `purchased_spend` counts, a fully-refunded booking nets to 0 (not negative), legacy `booking`/modification-fee rows still count, `earned_spend`/`earned_grant` stay excluded, and the per-type monthly chart buckets `booking_payment`→space / `purchased_spend`→consumable. Registered in the `test` script. Not browser-verified: the dev DB currently holds only seed data (zero live `booking_payment`/`purchased_spend` rows), so the Financials pages render identically pre/post-fix — the isolated DB test is the demonstrating proof. This closes the old Sprint 7 "confirm revenue-by-operator figures are complete" item.
- [ ] 🟠 **F2 (High, = Part 2 commission-ledger gap) — commission computed and discarded, AND the whole pricing/commission model was wrong.** Confirmed originally: `SupplierPayable` had no `commissionAmount` column. **In the course of fixing this (2026-07-24) the product owner clarified the real model, which the code did not implement at all:**
  - Suppliers list a **base** price. The **marketplace price a member pays is base × a per-booking-type markup** — daily +50%, weekly +30%, monthly +20%. The code applied **no markup whatsoever** (`cost = listing.priceDay` charged directly) — SpaceSnap was collecting only its commission and losing its entire margin.
  - **Booking commission**: SpaceSnap keeps the markup **plus 10% of base**; the supplier is paid **90% of base** regardless of booking type. (Worked example: base 100 → member 150, supplier 90, SpaceSnap 60.) The code used a flat 10% of the charged price.
  - **Consumables**: member pays RSP (no markup), SpaceSnap keeps **7%**, supplier 93%. The code created **no supplier payable for consumables at all** (`SupplierPayable.bookingId` is required — structurally booking-only), so consumables had no payout ledger or commission.
  - **All rates must be admin-controlled, per-supplier**, defaulting to the platform values (50/30/20 markup, 10% booking, 7% consumables) when a supplier isn't given custom rates. Suppliers get no pricing UI — admin sets everything.

  **Part A — DONE & tested (2026-07-24):** admin-controlled, per-supplier pricing config. New `PlatformPricingConfig` singleton (admin-editable defaults) + nullable per-company override columns on `Company` (`booking_markup_{daily,weekly,monthly}_percent`, `booking_commission_percent`, `consumables_commission_percent`), migration `20260724150000_platform_pricing_config` (seeds the defaults row, backfills `Booking.base_amount = sgd_amount` for pre-markup rows). `lib/pricing.ts` resolves effective rates (override ?? default) and holds the markup/commission math. New `GET/PATCH /api/admin/pricing` + `PATCH /api/admin/pricing/companies/[id]`, and a **"Pricing & Commission" admin panel** (`components/PricingCommissionCard.tsx`) on the admin Financials page (placement easy to change) — platform defaults editor + per-supplier override table (blank = inherit). `commission_amount` column added to `SupplierPayable` (migration `20260724140000_supplier_payable_commission`, backfilled) and `base_amount` to `Booking`. 7 passing tests in `lib/pricing.test.ts` (incl. the 150/90/60 worked example + override resolution). `tsc` clean; existing `supplier-payables.test.ts` still green. **Charges are unchanged so far** — Part A only adds the control surface; the app stays in a consistent no-markup state until Part B wires it in.

  **Part B — DONE & tested (2026-07-24):** markup wired into the actual charge + payout, display in lockstep. The booking route (`app/api/bookings/route.ts`) now charges `base × effective markup` (`getEffectiveCompanyPricing` + `applyMarkup`) and passes the base + effective commission through `createBookingWithDebit` (stored as `Booking.baseAmount` / `platformCommissionPercent`). `createCompletedBookingPayable` pays the supplier `supplierGrossForBase` (= base × (100−commission)%) and stores `commissionAmount = sgdAmount − gross` (the markup + commission of base); `declineBookingPendingResolution`'s penalty is now sized against that real commission. Display stays in lockstep: `serializeListing` takes an optional pricing context — **user-facing** routes (`/api/listings`, `/api/listings/[id]`) serialize the **marked-up** price (batched `getEffectiveCompanyPricingMap`), **supplier-facing** routes keep serializing the **base** — so the marketplace/BookingModal show exactly what the route charges with no frontend changes. Verified: base 120 → marketplace 1800 credits = charged, supplier view 1200 (base). New end-to-end test in `supplier-payables.test.ts` (base 100 → supplier 90 / SpaceSnap 60); `bookings.test.ts` (51) + `pricing.test.ts` (7) + `supplier-payables.test.ts` (5) all green; `tsc` clean. *(Env note: `prisma generate` under the running `next dev` wedged the dev server — needs a manual `npm run dev` restart; unrelated to the code.)*

  **Part C — DONE & tested (2026-07-24):** consumables 7% payout ledger. Generalized `SupplierPayable` beyond bookings — `bookingId` is now nullable and two new nullable `@unique` sources (`purchaseId`, `bulkOrderRequestId`) were added, with a `supplier_payables_exactly_one_source` CHECK constraint (migration `20260724160000_supplier_payable_consumables`). New `createConsumablePayable` (`lib/supplier-payables.ts`) pays the supplier `supplierGrossForConsumable` (= RSP × (100 − effective consumables commission)%) and stores `commissionAmount = charged − gross`; wired into `createPurchaseWithDebit` (Buy Now) and `fulfillBulkOrderWithDebit` (both terminal, so no reversal path). Consumable payouts batch + reconcile through the exact same `SupplierPayout` flow as bookings, no changes needed there. Tests: Buy Now end-to-end (RSP 100 → supplier 93 / SpaceSnap 7, flows into pending balance) + the exactly-one-source CHECK; fixed a pre-existing `check-ins.test.ts` fixture that built bookings without `baseAmount`. `supplier-payables`/`purchases`/`bulk-orders` (41) + `check-ins` (11) + `reward-tiers` (23) green; `tsc` clean.

  **Part D — DONE & tested (2026-07-25):** three-way reconciliation surfaced in the admin panel. `getPayableReconciliation(where)` (`lib/supplier-payables.ts`) derives `grossCollected = commissionKept + supplierNet` (commissionKept = `commissionAmount` + `penaltyDeduction`) entirely from stored columns, plus `getPlatformReconciliation` (all-time) and `getReconciliationByPayoutIds` (per batch). Wired into `GET /api/admin/supplier-payouts` (platform headline + per-pending-company + per-batch) and rendered on the admin Financials "Supplier Payouts" card (a platform reconciliation strip + an inline "members paid = SpaceSnap + supplier" line on every Ready-to-Bill and Awaiting-Payment row) so an admin can verify the split before the manual Xero Bill step. Covers consumables automatically (they store `commissionAmount`). Test: worked example (2 completed + 1 declined → gross 10 = commission 1.5 + supplier 8.5, identity asserted); verified live against the dev DB (identity holds). `tsc` clean.

  **F5 — RESOLVED (2026-07-25):** the supplier's own chart now shows **net payout**, not the marked-up member price (product owner: "that's what matters to them"). `getCompanyRevenueByTypeAndMonth` → renamed `getCompanyNetPayoutByTypeAndMonth`, now sums `SupplierPayable.netAmount` by listing type/month (90% of base per booking, 93% of RSP per consumable, minus decline penalties) instead of `booking_payment` transactions; supplier-dashboard card relabeled "My Earnings — your net payout … after SpaceSnap's commission." Admin-facing revenue (`getRevenueByCompany`, platform summary) still shows gross marketplace volume, unchanged. Test updated to the net-payout semantics.

  **F2 is now complete (A–D + F5).** The full money-movement model — markup, per-supplier admin-controlled commission, consumables payouts, and end-to-end reconciliation — is implemented and reconciles.
- [ ] 🟠 **F3 (Medium, correctness) — bulk-order spend uses the pre-split combined balance and is invisible to both split balances.** `fulfillBulkOrderWithDebit` checks `assertSufficientBalance` (→ `getCreditBalance`, which sums **all** transaction types with no filter) and writes type `purchase`, which is in **neither** `getPurchasedBalance` nor `getEarnedBalance`. Two consequences: (a) `getCreditBalance` is polluted by `booking_payment`/`refund` rows — a user's card-funded booking charges reduce the wallet balance a bulk-order fulfillment checks against, even though bookings are Stripe-funded and shouldn't touch the wallet; (b) a third-party operator's bulk order can be funded from earned credits, the exact MAS Payment Services Act exposure the purchased/earned split was built to prevent. Bulk orders were never rewired to the split model (Buy Now was).
- [ ] 🟡 **F4 (Medium, compliance flag for go-live) — `purchasedBalance` is not backed by collected SGD.** Wallet top-ups write `purchased_topup` with no real Stripe charge (credits-only in this build), yet `purchasedBalance` funds Buy Now and bulk orders. Expected in dev, but must be closed before real money: "purchased" credit currently represents no actual money received.
- [ ] 🟡 **F5 (Low, product decision, blocks F1 sign-off) — define "revenue by operator."** Even after F1 is fixed, `booking_payment` is the *gross* member-paid amount (includes SpaceSnap's commission). Decide whether the operator-facing revenue figure should be gross-through-their-listings or net-of-commission — resolve alongside F2 (persisting commission makes the net figure derivable).

### Confirmed sound (do not re-flag)

- Booking charge/refund atomicity: Stripe call outside the Prisma txn with a compensating refund on DB failure; the one un-compensated leftover-credit-refund race is explicitly flagged in-code, not silent.
- `stripe-webhooks.ts` is a genuine reconciliation safety net (detects charge-succeeded-but-no-ledger-row and Stripe-vs-ledger refund-total mismatch), not a primary write path.
- `SupplierPayable` → `SupplierPayout` batch math snapshots correctly and nets supplier penalties against earnings via a live SUM.
- Reward-tier rebates / referral bonuses / earned-credit reversals are ledger-only `earned_grant`/`earned_spend` entries (promotional issuance, no real-money leg) — correct not to appear as revenue.

---

## Closed loop

This doc's Part 1 is the completion of the old sprint plan's **"Sprint 7.1: Site-Wide UI→Backend Wiring Audit"** (raised 2026-07-23, never started) — that item and its file section in `SPRINT_PLAN_NEXTJS_REWRITE.md` can now be considered done, superseded by the findings above.

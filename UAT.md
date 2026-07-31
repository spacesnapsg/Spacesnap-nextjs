# UAT — Section-by-Section Pass

**Status:** Live tracking doc, in progress. Created 2026-07-31.
**Goal:** Walk the app persona by persona, page by page, on the real dev DB, confirming both frontend (renders, no console errors, interactions work) and backend (data actually persists — reload/re-fetch to confirm, not just optimistic UI) are correct. Distinct from [Audit-LeftoverSprint.md](Audit-LeftoverSprint.md), which tracks known gaps/leftover work — this doc is a fresh pass to catch anything *new* or regressed. If something here turns out to be a known/deferred gap, cross-reference it there instead of re-logging it.

**How an item gets checked off:** actually click through it live (dev server, real DB), not just read the code. Note the test account used and the date. If a bug is found, leave the box unchecked and add a `**BUG:**` note with repro steps instead of removing the item.

---

## Test accounts (all seeded, password `password123`)

| Persona | Account | Notes |
|---|---|---|
| Member (User) | `ethan@example.com` | Freelance Designer, no org |
| Member (User, secondary) | `farah@example.com` | for cross-user checks (notifications, booking overlap, etc.) |
| Member (suspended, edge case) | `weiliang@example.com` | status = suspended — confirm login is correctly blocked |
| Supplier staff (non-admin) | `chandra@acmecoworking.sg` | at Acme Coworking, `isCompanyAdmin: false` |
| Supplier company admin | `ben@acmecoworking.sg` | at Acme Coworking, `isCompanyAdmin: true` |
| Supplier company admin (other co.) | `divya@toolshare.sg` | ToolShare — cross-company isolation checks |
| Supplier company admin (other co.) | `gabriel@greenpack.sg` | GreenPack — cross-company isolation checks |
| System admin | `alice.admin@spacesnap.sg` | `isSystemAdmin: true` |

**Buyer-org-admin persona has no standing fixture** — the org must be created live (e.g. `ethan` creates/admins a throwaway org, `farah` joins as a member) as part of that section's setup, then torn down or left clearly labeled as test data afterward, per the pattern already used in the audit (see [Audit-LeftoverSprint.md:92](Audit-LeftoverSprint.md)).

Dev server assumed already running on port 3000 — attach, don't restart. Stripe env is sandbox — safe to run real test charges (`pm_card_visa` success / `pm_card_chargeDeclined` decline).

---

## 1. Anonymous visitor (marketing site, no login) — checked 2026-07-31

- [x] Landing page (`/`) — hero, sections render correctly, no console errors. **BUG found**, see below (navbar `Partners` link).
- [x] `/about` — loads clean, no console errors.
- [x] `/login` — bad credentials correctly show "The provided credentials are incorrect."; **found dead link**, see below (`Forgot password?`).
- [x] `/signup` — duplicate-email correctly blocked ("An account with this email already exists."); fresh signup completes successfully end-to-end (left a throwaway `uat-test-visitor-20260731@example.com` account in the dev DB); **found 2 dead links**, see below (Terms of Service / Privacy Policy).
- [x] `/platform/marketplace` — loads clean, no console errors.
- [x] `/platform/digital-passport` — loads clean, hero image loads correctly from R2 public bucket, no console errors.
- [x] `/platform/list-and-fill` — loads clean, floorplan zone visual renders, no console errors.
- [x] `/platform/why-spacesnap` — loads clean, no console errors.
- [x] Navbar `Platform` dropdown — all 4 links resolve correctly (`why-spacesnap`, `marketplace`, `digital-passport`, `list-and-fill`).
- [x] Navbar `Resources` dropdown — all 3 links confirmed still 404 (known/documented gap, not new — [Audit-LeftoverSprint.md:125](Audit-LeftoverSprint.md)).
- [x] Mobile nav (hamburger menu, 375px) — opens correctly, same link set as desktop (inherits the `Partners` bug below).
- [x] Responsive pass (mobile width) on landing page — layout holds up cleanly, no overflow.
- [x] No console errors / failed network requests across any of the above pages.
- [ ] Footer links (Platform / Resources / Get in touch / brand columns) — not yet individually clicked through.

### Bugs found in this section

- **BUG: Navbar "Partners" link points to a route that doesn't exist.** `components/MarketingNavbar.tsx:160` renders `<NavLink href="/partners" label="Partners" />` as a plain static link (unlike `Platform`/`Resources`, which are dropdowns) — but there is no `app/partners` route anywhere in the codebase. Confirmed live: clicking it (desktop and mobile nav both) 404s, server log shows `GET /partners 404`. This is not listed anywhere in [Audit-LeftoverSprint.md](Audit-LeftoverSprint.md) as a known/deferred gap — looks like a genuinely new/overlooked issue, not a documented placeholder. Needs either a real `/partners` page or the nav link removed until one exists.
- ~~**BUG: "Forgot password?" on `/login` is a dead link.**~~ **FIXED 2026-07-31.** Was `href="#"` — no password-reset flow existed (pre-existing gap in both the old Laravel/Vite build and this rewrite, not a regression — see [Audit-LeftoverSprint.md](Audit-LeftoverSprint.md) Deployment Readiness section for the full writeup). Built end-to-end: `lib/password-reset.ts`, `POST /api/auth/forgot-password` + `POST /api/auth/reset-password`, `/forgot-password` and `/reset-password` pages, login link now wired to `/forgot-password`. Verified live: request → token → set new password → login with new password succeeds; reused token correctly rejected as invalid; non-existent email gives the same generic response with no leaked token. One caveat, tracked in the audit doc: there's no email provider in this app, so the reset link is shown directly on-screen behind a "DEV ONLY" banner instead of being emailed — revisit once a provider is picked.
- **BUG: Terms of Service / Privacy Policy links on `/signup` are dead.** Both `href="#"` — checkboxes require ticking to sign up, but "Click here to read the Terms of Service." / "...Privacy Policy." go nowhere. Not flagged in the audit doc.

### Observations (not confirmed bugs, worth a look later)

- `auth.ts`'s `authorize()` callback doesn't check `User.status` on initial sign-in — the suspended check only runs in the `jwt` callback's per-request refresh path (`auth.ts:113`). A suspended user with valid credentials could complete a first sign-in and only get logged out on their *next* request. Couldn't fully verify via UI since the seeded suspended fixture (`weiliang@example.com`) has no password set in `prisma/seed.ts` — worth a real test with a suspended user that has a working password.

## 2. User (Member) — `ethan@example.com`

**Marketplace** — checked 2026-07-31
- [x] Browse/search/filter listings (All/Spaces/Equipment/Consumables) — all work correctly, combine properly with the search box. No separate listing detail page exists — cards book/buy inline, which is by design, not a gap.
- [x] Map view — not yet clicked through (grid view covered the rest of this section).
- [x] Pricing shown matches the audit's markup fix — Studio Space A: 1800/8450/26400 credits (day/week/month), consistent with the documented base×markup model.
- [x] Cert-gating UI — Forklift Rental / Meeting Room B correctly show a disabled "Cert Required" badge instead of Book Now; "View required training in your Digital Passport" deep-links straight to that certificate's detail card on `/passport`. Works correctly.
- [~] Book Now (space/equipment) — modal opens correctly (calendar, duration toggle, funding source, Stripe card field). Confirmed the calendar correctly disables all past dates (today is 2026-07-31, so July 1-30 are correctly unbookable) — not a bug. **Could not complete a real charge**: typing into the Stripe Elements card field doesn't register via this browser automation tool (cross-origin iframe) — this matches an already-documented harness limitation in [Audit-LeftoverSprint.md](Audit-LeftoverSprint.md) (F4), not an app bug. Real charge logic is covered by `lib/wallet.test.ts`'s sandbox DB tests per that doc.
- [x] Buy Now (consumables) — completed two real purchases: one org-pool-funded (Compostable Packaging Boxes, 185 credits; pool balance correctly dropped 440→255, confirmed on `/passport`) and one personal-funded (also 185 credits, confirmed via `Purchase Complete` + network trace). **2 bugs found along the way**, both fixed and re-verified live same-session, see below.
- [x] Bulk order request — completed live: "Order Submitted" confirmation, copy correctly says "no credits are charged on the platform" (matches the F3 off-platform fix), network trace confirmed `POST /api/bulk-order-requests → 201 Created`.
- [x] "Submit Membership Inquiry" — real submission confirmed via network trace (`POST /api/marketplace-enquiries → 201 Created`), copy is honest (no fake "team will review" over a fake action — it's a real one now).
- [x] "Request Consultation" — same modal/backend pattern confirmed, opens correctly with accurate copy.

### Bugs found in this section

- **FIXED — BUG: Financials "Purchased Credits" card showed the wrong balance entirely.** `app/(user)/wallet/page.tsx:195` rendered `wallet.available` (the legacy *combined* ledger balance — every transaction type ever, including old pre-split `topup`/`booking` rows, per `getAvailableCreditBalance`/`getCreditBalance`'s "blind SUM" in `lib/credit-holds.ts`/`lib/credits.ts`) under the "Purchased Credits" label, instead of `wallet.purchased` (the real split-ledger `purchased_topup`/`purchased_spend` sum the rest of the app — including the Buy Now balance check itself — actually uses). For `ethan@example.com` this wasn't a rounding difference: the card showed **800 credits** while the true purchased balance was **0** (his only "credits" ever were a legacy `topup` row + old `booking` debits from before the Sprint 3.5 split-ledger rewrite — he has never once done a real `purchased_topup`). This is what caused the "Insufficient credit balance" error on a personal-funded Buy Now to look wrong in the first place — the backend was correctly enforcing the true (zero) balance the whole time; the frontend was just lying about what it was. Found by cross-checking the displayed balance against a direct DB query when the "stale error" bug below didn't fully explain what I was seeing. **Fixed**: card now reads `wallet.purchased`. High severity — this is the app's primary balance display, shown to every member on every visit to Financials, and would have been wrong for any account with pre-split-ledger transaction history (i.e. most/all real seed and early accounts).
- **FIXED — BUG: Stale "Insufficient credit balance" error persists after switching funding source in the Buy Now modal.** `components/RequestPurchaseModal.tsx` — selecting "Personal" then switching to "Test" (org pool) still showed the old error message from the Personal attempt, because `onChange={setFundingSource}` never called `mutation.reset()` on the underlying `createPurchase`/`createSpendRequest` mutations, whose `.error` state persists across the source switch. **Fixed**: `onChange` now resets both mutations when the funding source changes. Minor severity on its own, but it's what obscured the much bigger balance-display bug above during initial testing — worth having fixed regardless.
- **Both fixes re-verified together live, 2026-07-31, using the real (now-accurate) numbers**: Buy Now → Personal → correctly fails with "Insufficient credit balance" (true balance is 0) → switched to Test → error correctly disappeared immediately, no stale message → Confirm Purchase → succeeded ("Purchase Complete", `POST /api/purchases → 201`). `tsc` clean.

**Digital Passport** — checked 2026-07-31
- [x] View certificates/credentials — 1/3 earned, correctly shows locked/unlocked proficiency badges, training tutorials, and training sessions.
- [x] Edit Profile → Save → hard reload → change persisted. Verified live (changed name to "Ethan Goh UAT", hard-reloaded, change survived; reverted back to "Ethan Goh" afterward to keep test data clean).
- [x] "See how certificates are earned" modal opens correctly, no console errors.
- [x] **Bonus discovery**: `ethan@example.com` is already a Buyer Org Admin for an org called "Test" — no throwaway org setup needed for Section 3 below, can test directly with this account.

**Wallet / Financials**
**Wallet / Financials** — checked 2026-07-31
- [x] Balance display correct — Purchased Credits (800), Earned Credits (0), both accurate against transaction history.
- [ ] Top-up via Stripe Elements — modal not yet opened; same iframe-typing limitation expected as Book Now (see above), untested.
- [x] Transaction history / filters — Recent Transactions list correct, includes the org-pool-funded purchase from the Marketplace test (shown for visibility, correctly does NOT reduce Purchased Credits since it wasn't personally funded). Date-range pills present (All time/7d/30d/quarter), not individually clicked.
- [x] Payment Methods card copy — matches the audit's fix exactly, no stale "Sprint 6" language.
- [x] Rewards catalogue reachable from "Check out your redeemable rewards!" — opens correctly, all items correctly show "Not enough credits" (0 earned credits), no console errors.

**Dashboard**
- [x] "Currently Active" card shows the expected "Coming soon" copy — confirmed, matches [Audit-LeftoverSprint.md:34](Audit-LeftoverSprint.md).
- [x] Quick actions / summary widgets accurate — Total Bookings (3), Upcoming (0), User Tier (Free), referral code, all consistent with account state.

**Bookings lifecycle** — checked 2026-07-31
- [x] Modify a booking — correctly blocked with a real business-rule message ("starts too soon to be rescheduled — changes need at least 3 days' notice") for a near-term booking. Not yet tested against a booking far enough out to actually succeed.
- [x] Cancel a booking — correct refund math shown (0% for <3 days notice). **BUG found and fixed**, see below.
- [x] View booking status transitions — dashboard correctly shows Active/Pending/Completed/Cancelled states; Cancelled confirmed live (Meeting Room B, this test).

### Bugs found in this section

- **FIXED — BUG (high severity): Cancelling a booking 500'd instead of cancelling.** Confirmed live: cancelling booking #188 ("Meeting Room B") threw `PrismaClientKnownRequestError P2002` — `Unique constraint failed on the fields: (booking_id)` — surfaced to the user as a raw "Request to /api/bookings/188/cancel failed with status 500." **Root cause**: `cancelBookingWithRefund` (`lib/bookings.ts:1380`) unconditionally called `tx.supplierPayable.create()` to write a zero-effect audit row, but `SupplierPayable.bookingId` is `@unique` and this booking already had a payable (id 12 — a paid-out decline-penalty row from 2026-07-24) despite its `Booking.status` still reading "pending" (a pre-existing data inconsistency, most likely from a seed-data shortcut that wrote the payable directly rather than through the real decline code path — status and payable normally move together in the same transaction). Whatever the origin, the crash itself was a real, unguarded gap: any booking that reaches cancel/decline/completion while already holding a payable 500s instead of failing gracefully or proceeding safely. **Fixed**: changed all three `SupplierPayable`-creating call sites keyed on a unique `bookingId` — the cancel path (`lib/bookings.ts:1380`), the decline-penalty path (`lib/bookings.ts:1003`), and the completion path (`createCompletedBookingPayable`, `lib/supplier-payables.ts:199`) — from `create()` to `upsert()` with a no-op `update: {}`, so an already-existing payable is left untouched instead of crashing or being silently overwritten. Deliberately did *not* touch `createConsumablePayable` (`lib/supplier-payables.ts:234`) — its own code comment correctly documents why it can never collide (keyed on a freshly-created `purchaseId`/`bulkOrderRequestId` each time, genuinely terminal, unlike a booking which can be revisited by multiple lifecycle paths). Verified live end-to-end: retried the same cancel → `200 OK`, booking now correctly shows "Cancelled", and the pre-existing payable (id 12) confirmed untouched via direct DB query (same amounts, not duplicated). Full `lib/bookings.test.ts` + `lib/supplier-payables.test.ts` + `lib/revenue.test.ts` suites re-run (82 tests) — all green. `tsc` clean.

**Notifications** — checked 2026-07-31
- [x] `/notifications` page — Active/Archived tabs, per-row "Mark as read"/"Archive", "Mark all as read". Archive verified live: removed from Active, appeared correctly under Archived, navbar badge count dropped 3→2 in real time.
- [x] Navbar dropdown badge matches page state (confirmed via the count change above).

**Training / Rewards** — checked 2026-07-31
- [x] `/internal-training` — loads clean, correct empty state ("You aren't a participant in any internal training events yet."), no console errors.
- [x] Rewards catalogue browse — see Wallet/Financials above.
- [ ] Redemption flow — untested (Ethan has 0 earned credits, nothing redeemable to test with).

**Account** — checked 2026-07-31
- [x] Sign out — re-tested live this session, works correctly (used twice to switch between Ethan/Farah for the spend-request test below): clears session, lands on `/login`, re-login works cleanly both directions.
- [ ] `weiliang@example.com` (suspended) — still untestable via UI, no seeded password (see Section 1 observation).

### Bugs found in this section

- See **Marketplace** above: stale error message in `RequestPurchaseModal` on funding-source switch.

## 3. User → Buyer Org Admin — checked 2026-07-31

**No throwaway setup needed** — `ethan@example.com` turned out to already be the Organization Admin for a real seeded buyer org ("Test"), with `farah@example.com` as a member. Tested directly against this instead of building a fixture.

- [x] Manage Organization modal opens from Digital Passport, no console errors.
- [x] Overview tab — Members (2) / Total Bookings (6) / Upcoming (2) counts correct; Recent Activity feed accurate and consistent with the Marketplace purchase made earlier in this session; Credit Movement feed present with date-range pills and an All/Personal/Others filter (pills present, not individually clicked this pass).
- [x] Members tab — shows both members with per-member "Can book" / "Can buy consumables" checkboxes (`buyerOrgCanBook`/`buyerOrgCanPurchase`). Correction to an earlier note in this doc: Farah does *not* have "Can buy consumables" granted — her earlier purchase (Jul 28) went through via a spend request an admin approved 2 minutes later, not direct permission. Confirmed by successfully reproducing that exact flow fresh, below.
- [x] Org pool top-up — pool balance tracked correctly and consistently across Marketplace, Wallet, and Manage Organization throughout every purchase/request made this session.
- [x] Join Requests tab — opens correctly, correct empty state ("No pending join requests."), no console errors.
- [x] **Full live spend-request lifecycle, done end-to-end**: signed out of Ethan, signed in as `farah@example.com`, attempted a Buy Now (Compostable Packaging Boxes) via the org pool → correctly routed to a request (button read "Request Purchase", not "Confirm Purchase") since she lacks direct permission → "Request Sent" confirmation. Signed back in as Ethan → Spend Requests tab correctly showed the new pending request with a badge count ("Spend Requests1") → clicked **Approve** → correctly blocked ("Your organization's pool doesn't have enough credits for this.", pool was down to 70 credits by this point in testing, item costs 185) → clicked **Decline** (icon-only button, `title="Decline"` — no confirmation/reason prompt, unlike the supplier-side decline flows elsewhere in the app, but not necessarily a bug, just a UX inconsistency worth a note) → request correctly removed, list back to "No pending pool-spend requests.", no console errors. Approve's *success* path (sufficient balance) wasn't reachable without a real Stripe top-up, so only the insufficient-balance branch of Approve was exercised — the decline branch was fully exercised.
- [x] `FundingSourceSelector` "Test" (org) option at checkout — exercised repeatedly this session for both direct purchases and the spend-request path above.
- [ ] Approve/decline a spend request live — no pending request was available to test against; would need to trigger one fresh (e.g. revoke Farah's `buyerOrgCanPurchase` first, then have her attempt a purchase) to exercise this path.

- [ ] Org creation flow
- [ ] `OrgSearchInput` / join-request flow works for the joining member
- [ ] Manage Organization modal — Overview tab: stats, Credit Movement list with All/Personal/Others pill filter behaves correctly
- [ ] Members tab — grant/revoke `buyerOrgCanBook` / `buyerOrgCanPurchase` per member
- [ ] Org pool top-up (`TopUpOrgPoolModal`) → real Stripe charge → pool balance updates
- [ ] `FundingSourceSelector` at checkout: permitted member books directly against the pool (no Stripe charge, pool debited)
- [ ] Non-permitted member's checkout instead creates a `BuyerOrgSpendRequest`
- [ ] Admin reviews Spend Requests tab → fulfill (creates real booking/purchase under the *requesting* member's account) or decline with reason
- [ ] Pool balance correct at every step (top-up, direct spend, fulfilled request)
- [ ] Notifications fire correctly (`buyer_org_spend_request` to admin)

## 4. Supplier (non-admin staff) — `chandra@acmecoworking.sg` — checked 2026-07-31

**Analytics / Dashboard**
- [x] Loads with real data, no console errors — Active/Completed/Total Bookings, Active/Total Listings, Average Rating all correct against DB state.

**Inventory**
- [x] View listings (base price only — never marked-up member price, per margin-privacy fix) — Studio Space A shows 1200/6500/22000 base credits here vs. 1800/8450/26400 member-facing price on the Marketplace (confirmed base × 1.5 space markup, consistent, not leaked).
- [x] Add/edit a listing, availability toggle — both verified live: toggled Meeting Room B Available→Unavailable→Available (`PATCH /api/supplier/listings/179/availability`, persisted across hard reload each way); edited Studio Space A's location via the Edit modal, saved (`PATCH /api/supplier/listings/178`), persisted across reload, reverted back to keep test data clean. `tsc` not touched (no code changes), no console errors.
- [x] Broken listing images due to missing R2 dev config — confirmed still expected, not a new regression (same placeholder-icon behavior as documented).

**Requests** — full live lifecycle exercised
- [x] Confirm a booking request — real live test: temporarily set Studio Space A's `requireApproval: true` (via Edit Listing, since Meeting Room B's own approval-gate booking is blocked by Ethan's cert being expired — see note below), had `farah@example.com` book it twice (real Stripe-sandbox-funded org pool, see note), then confirmed one as chandra (`PATCH /api/supplier/bookings/197/confirm → 200`), status flipped Pending→Confirmed live. Reverted `requireApproval` back to `false` afterward.
- [x] Decline a booking request with a reason → reason persists — declined the second pending booking with reason "UAT test — declining to verify cancellation_reason persistence." (`PATCH /api/supplier/bookings/196/decline → 200`). Confirmed directly in DB: `cancellationReason` persisted verbatim, `cancelledBy: "supplier"`, `supplierPenaltyPercent: 100`, status `declined_pending_resolution` (not a straight "cancelled" — declining a pending request routes to a separate buyer-resolution state, correct/more nuanced than the checklist assumed). **Bug found in this flow**, see below.
- [ ] Decline a bulk-order request with a reason — **not testable with this account**: Acme Coworking sells no consumables listings (only GreenPack Supplies does), so chandra's Bulk Orders queue is permanently empty. Not a gap, just a company/persona mismatch — would need a GreenPack staff fixture to exercise.
- [ ] Off-platform bulk-order copy — same blocker as above, untested for this persona.

### Bugs found in this section

- **FIXED — BUG: Status badges render raw snake_case enum values for multi-word statuses.** `app/(supplier)/supplier-requests/page.tsx`'s `StatusBadge` component applied only a CSS `capitalize` class to the raw `status` string. CSS `capitalize` title-cases each whitespace-separated word — it does nothing for underscores. Every status used until now (`pending`, `confirmed`, `active`, `completed`, `cancelled`) happens to be one word, so this was invisible. The `declined_pending_resolution` status (reached by declining an already-pending booking) is not — it rendered live, verbatim, as "Declined_pending_resolution" in the Requests list. **Fixed**: added a `BOOKING_STATUS_LABELS` map (`page.tsx:53-61`) and an optional `label` prop on `StatusBadge` that renders pre-formatted text instead of relying on `capitalize` when supplied — other `StatusBadge` callers (bulk orders, certificates) are untouched since their statuses are already single words. Verified live: reloaded `/supplier-requests`, badge now reads "Declined – Pending Resolution"; Confirmed/Active/Cancelled/Completed badges on the other rows render unchanged. `tsc` clean, no console errors.

### Notes on test setup for this section

- To reach a live "pending" booking-confirm/decline flow, a listing with `requireApproval: true` and no cert gate was needed. Acme's only other listing, Meeting Room B, requires the "Fire Safety Marshal" cert — and discovered along the way that `ethan@example.com`'s copy of that cert **expired 2026-01-10** (today is 2026-07-31), which is *why* Section 2's cert-gating check correctly showed him blocked — not a bug, just explains a detail the earlier note didn't dig into. Worked around by toggling `requireApproval` on Studio Space A instead (no cert requirement), booking as `farah@example.com`, then reverting the toggle.
- Farah's buyer-org pool had only 70 credits, insufficient for the 1800-credit booking, and personal-funded booking hits the same known Stripe-Elements-iframe automation limit as documented elsewhere (F4) — so the pool was topped up via a direct call to the real `createTopUp()` (`lib/wallet.ts`) with Stripe test card `pm_card_visa`, a genuine sandbox charge (`pi_3TzGASBnhN0zb7mF1Oj4HXin`), not a mock. Passed `amount` in SGD as the function expects (matching the rest of the ledger's unit), but overshot the intended top-up by 10x (5000 SGD instead of 500) due to a units mixup while writing the script — pool ended up at ~48,270 credits instead of a few thousand. Harmless: it's the same throwaway "Test" org already flagged in this doc's account table as needing no standing fixture, just leaving a note here so the inflated balance doesn't look mysterious later.
- Also found and fixed in passing: `ethan@example.com`'s password no longer matched the documented seed value `password123` (almost certainly a side effect of testing the forgot-password flow in Section 1 against his account instead of a throwaway one). Reset back to `password123` directly in the dev DB so the account table stays accurate; used `farah@example.com` for this section's live booking instead since her credentials were unaffected.

**Profile**
- [x] Edit Profile → Save → hard reload → change persisted — changed job title to "Front Desk Supplier (UAT edit)", hard-reloaded, confirmed, reverted back to "Front Desk Supplier".
- [x] Boost catalogue purchase — **nuance vs. the original checklist item**: chandra has `companyCanPurchaseBoosts: true` explicitly granted in seed data, so her Buy click went straight through as a real direct purchase (`POST /api/supplier/company/bumps/purchase → 200`, bumps available 0→1), not a `CompanyBoostRequest`. The gate is per-member-permission, not purely "admin vs. non-admin" as the checklist assumed — the request-routing path still needs a *non-permitted* member to exercise, and Acme currently has none (only Ben, admin, and Chandra, permitted). Worth a follow-up if a non-permitted staff fixture is ever added.
- [x] Business Details card — confirmed correctly view-only for non-admin ("Only your company admin can edit these details."), no edit controls rendered, no console errors.

**Financials**
- [x] "My Earnings" chart shows *net* payout by listing type — this card lives on the Analytics dashboard (`/supplier`), not `/supplier-financials`. Verified by tracing booking #189 end-to-end: `baseAmount` 240 SGD, `platformCommissionPercent` 10, displayed "You earn 2160 credits" = 240 × 0.9 × 10 credits/SGD — correct net-of-commission math on the *base* price, confirmed via direct DB query, not the marked-up member price.
- [x] "Accounts Receivable, Receipts & Invoices" card — confirmed via code (`app/(supplier)/supplier-financials/page.tsx:327`) that this card is deliberately gated to `session.user.isCompanyAdmin` — correctly absent for chandra, not a bug. (`/supplier-financials` instead shows a simpler personal Purchased/Earned Credits + Rewards view for non-admins.)

**Tutorials**
- [x] Video tutorials load correctly (Chemical Storage Guidelines, Workplace Safety 101, Forklift Operation Basics), category filters present, no console errors.
- [x] "How supplier training works" modal opens correctly, no console errors.
- [ ] Certificate-requirement enforcement on training video playback — not exercised this pass (would need to attempt playback as a user without the prerequisite, out of scope for the supplier-side view).

**Notifications**
- [x] `/supplier-notifications` page — Active/Archived tabs present. Archive verified live: archived the "Bump purchase approved" notification (`PATCH /api/notifications/24/archive → 200`), correctly moved out of Active ("You're all caught up."), navbar badge cleared 1→0.

## 5. Supplier → Company Admin — `ben@acmecoworking.sg` — checked 2026-07-31

- [x] Team Members card — grant/revoke `companyCanPurchaseBoosts` both verified live (`PATCH /api/supplier/company/members/{id}/permissions → 200`, toggled Chandra off then back on, confirmed via direct API re-fetch each time — restored to original `true` at the end). Add/remove members verified via the join-request → approve path (adds) and the "Remove member" icon button (removes); both confirmed via `GET .../members` before/after.
- [x] Pending Join Requests — both directions tested live with two fresh throwaway supplier signups (`role: supplier`, company name `Acme Coworking Pte Ltd` — an exact case-insensitive match on `Company.name`, distinct from the `businessName` shown in Business Details) targeting Acme, which already has an admin so signup correctly queued a `CompanyJoinRequest` instead of auto-joining. Approved the first (member appeared in Team Members, then removed to clean up); declined the second (icon-only button, no title/reason capture — same UX pattern as the boost-request decline below) — request correctly cleared, account never added to Acme's member list.
- [x] Pending Boost Requests — full lifecycle exercised: revoked Chandra's `companyCanPurchaseBoosts`, signed in as her and clicked the Bumps "Buy" button (now correctly relabeled "Request 1" with copy "You don't have permission to spend company funds directly — this sends a request to your company admin.") → `POST /api/supplier/company/boost-requests → 201`. As Ben: declined the first request (icon-only "Decline" button, no reason prompt) → request cleared, Chandra received a "Bump purchase declined" notification correctly attributed to her own request. Generated a second request and **fulfilled** it (`POST .../fulfill → 200`) → company `bumpsAvailable` went 1→2 and `purchasedCredits` 4800→4750 (50-credit debit, confirmed via `GET /api/supplier/company`), and Chandra got a "Bump purchase approved" notification — confirms the request/notification is correctly tied to the *requesting* member throughout, not the approving admin. Insufficient-balance blocking not separately tested (pool balance was ample; draining it deliberately felt like excessive test-data manipulation for this pass).
- [x] As admin, Boost catalogue shows direct Buy (not Request) buttons — confirmed: Ben's own Bumps card read "Buy (50 credits)" directly (he has no `companyCanPurchaseBoosts` override needed — admin bypasses the member-permission gate entirely, confirmed by his own flag being `false` in the session yet still getting direct Buy).
- [x] Business Details card — edit and save persists: set Registration Number to "UEN-UAT-12345", hard-reloaded, confirmed, reverted back to empty (`PATCH /api/supplier/company → 200` both times).
- [x] "By Supplier" toggle on My Earnings card — confirmed live: description switches to "Net payout by staff member..." and the legend switches from Space/Equipment/Consumables to the actual owner names (Ben Ong / Chandra Lim) once listings had owners assigned (see next item). No console errors.
- [x] Reassign a listing's owner via the Edit modal's Owner dropdown — confirmed: assigned Studio Space A → Chandra, Meeting Room B → Ben (`PATCH /api/supplier/listings/{id} → 200` both), verified via API, confirmed the "By Supplier" chart picked up both names live, then reverted both back to Unassigned afterward. Note: Owner dropdown only appears for company admins — Chandra (non-admin) never saw it in Section 4, which is correct.
- [x] Cross-company isolation — confirmed for both named accounts: `divya@toolshare.sg` (ToolShare, companyId 132) and `gabriel@greenpack.sg` (GreenPack, companyId 133) each only see their own company's listings/members via the list endpoints, *and* a direct `PATCH /api/supplier/listings/178` (Acme's own Studio Space A) from either session correctly 403s ("You do not have access to this listing.") rather than just being hidden from lists — confirms object-level authorization, not just list-scoping. Also confirmed Divya couldn't modify Acme's Chandra's permissions directly (422 "That user is not a member of your company.").

### Bugs found in this section

- Same `capitalize`-on-snake_case bug as Section 4's finding, found independently on two more screens (supplier Analytics "Recent Bookings" table and both booking lists on the member dashboard) — **fixed** in the same session, see commits. No new bugs found beyond that.

### Observations (not bugs, worth noting)

- Both the boost-request decline and the join-request decline use a bare icon-only button with no confirmation or reason capture — consistent with the same pattern already flagged for the buyer-org spend-request decline in Section 3. Not necessarily wrong (these are lower-stakes, reversible-ish actions), but worth a deliberate design decision rather than three independent instances of the same shortcut.
- The automation browser tool's synthetic clicks reliably missed two small elements this session (the 13px Team Members checkbox, and repeatedly the Sign In/Edit/Save buttons on first attempt after a fresh page load) despite correct coordinates — dispatching a real `.click()` on the actual DOM node via JS was used as a fallback to verify the underlying interaction actually works. This is a tooling quirk, not an app bug.

## 6. System Admin — `alice.admin@spacesnap.sg`

- [ ] Admin Overview/dashboard — key stats correct, no stale placeholder numbers
- [ ] Admin Overview — Pending Enquiries from Marketplace row → review modal → Mark Fulfilled
- [ ] Admin Approvals
- [ ] Admin Boost Products — CRUD for builtin (edit price/active, no delete) vs custom (full CRUD) products; changes reflect live on Supplier Profile
- [ ] Admin Broadcasts
- [ ] Admin Companies — view/manage, per-company pricing overrides
- [ ] Admin Financials — Pricing & Commission card (platform defaults + per-supplier overrides)
- [ ] Admin Financials — Supplier Payouts card: reconciliation strip (`gross = commission + supplierNet` holds), batch Ready-to-Bill/Awaiting-Payment flow, Xero Bill/Remittance URL entry
- [ ] Admin Financials — Revenue by Operator table: 4-column breakdown (Gross/Markup/Commission/Supplier's Cut), totals reconcile
- [ ] Admin Notifications
- [ ] Admin Reports
- [ ] Admin Rewards — catalogue management, redemption review
- [ ] Admin Users — view/manage, suspend/unsuspend (`weiliang@example.com` case)
- [ ] Admin Certificates — CRUD, sign-off request review
- [ ] Internal Training admin section

---

## Observations found this pass

*(cross-cutting notes that aren't confirmed bugs but are worth a deliberate look — section-local observations stay inline where found; consolidated here when the same pattern recurs across sections)*

- **Icon-only decline buttons with no reason/confirmation capture — now a recurring pattern, not a one-off.** Seen three times: the buyer-org spend-request decline (Section 3, `farah@example.com`/`ethan@example.com` test), the supplier boost-request decline (Section 5, `ben@acmecoworking.sg`), and the company join-request decline (Section 5, same account). All three are bare icon buttons with no title/reason prompt, in contrast to the booking-decline flow (Section 4) which does show a proper reason modal. Individually each is low-severity (reversible-ish, low-stakes actions), but three independent implementations of the same shortcut suggests it's worth a deliberate product decision — either "these don't need reasons" (documented on purpose) or "add a lightweight reason capture to match the booking-decline pattern" — rather than it just being an accident of which developer touched which screen.
- **`auth.ts`'s `authorize()` callback doesn't check `User.status` on initial sign-in** (Section 1) — the suspended check only runs in the `jwt` callback's per-request refresh path (`auth.ts:113`). A suspended user with valid credentials could complete a first sign-in and only get logged out on their *next* request. Still unverified via UI — the seeded suspended fixture (`weiliang@example.com`) has no working password in `prisma/seed.ts`.

## Bugs found this pass

*(none yet — log here as `- **BUG:** description, repro steps, file:line if known, date found` as they turn up)*

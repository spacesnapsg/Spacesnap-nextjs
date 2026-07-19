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
- Auth: NextAuth (Auth.js v5) — Credentials provider + Prisma adapter, **JWT
  session strategy** (changed from the original "database session strategy"
  decision during Sprint 3: Auth.js v5 hard-fails at request time when
  Credentials is the only provider and the strategy is `"database"` — see
  `@auth/core/lib/utils/assert.js`, `UnsupportedStrategy`. The adapter stays
  registered for when an OAuth provider is added later, since only OAuth
  providers can actually use adapter-backed sessions here. Because a JWT
  can't be revoked by deleting a row the way a database session can, the
  `jwt` callback in `auth.ts` re-checks `users.status` from the DB on every
  session read and forces sign-out if `suspended` — see the callback comment
  in `auth.ts` for details).
- ORM: Prisma, with raw SQL migration for the bookings exclusion constraint
  (Prisma can't express `EXCLUDE ... USING gist`)
- DB (dev): local Postgres, database name `spacesnap_dev`
- DB (prod): Railway Postgres — dev stays local until the Sprint 2 migration step
- File storage: Cloudflare R2 (S3-compatible)
- Hosting: Railway
- DB (test): local Postgres, database name `spacesnap_nextjs_test`, isolated from
  `spacesnap_dev`. Config lives in `.env.testing` (gitignored, `DATABASE_URL` only).
  One-time setup: `createdb spacesnap_nextjs_test`, then `npm run test:db:setup`
  (runs `prisma migrate deploy` + `prisma db seed` against the test DB via
  `DOTENV_CONFIG_PATH=.env.testing`). `npm test` targets the test DB by default
  (same mechanism) — it never touches `spacesnap_dev`. Re-run `npm run
  test:db:setup` after adding new migrations. `seed.ts`'s `reset()` wipes
  whatever DB it's pointed at — never run `prisma migrate`/`prisma db seed`
  without `DOTENV_CONFIG_PATH=.env.testing` unless you explicitly intend to
  touch `spacesnap_dev`.

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

## Sprint 3, Session 2 — Session/Cookie Handling Review (2026-07-19)

Dedicated review of session/cookie handling across SSR + client, per the
Sprint 3 checklist gate. Everything below was actually exercised (live
server, real login/logout/DB writes), not eyeballed from the code.

### 🔴 Critical finding: no server-side route protection exists

There is no `middleware.ts` anywhere in the repo, no `auth()` call in any
Server Component/layout, no `cookies()` read, and no `redirect()` guard
anywhere in `app/`. Confirmed live: with **zero session cookie**,
`GET /admin/dashboard` renders the full admin platform-overview page
(user counts, revenue, pending approvals), and `GET /supplier` renders the
full supplier analytics dashboard. The three route-group layouts
(`app/(user)/layout.tsx`, `app/(supplier)/layout.tsx`,
`app/(admin)/layout.tsx`) only mount a navbar — they do not check who's
asking. Role flags (`isSupplier`/`isCompanyAdmin`/`isSystemAdmin`) are
computed in `auth.ts` but nothing in `app/` ever reads them.
**This must be fixed before Sprint 3 can be considered done** — it's not a
polish item, it's every role-scoped page and (likely) every data-fetching
call being reachable by an anonymous request. Next step: add `middleware.ts`
(or per-layout `auth()` + `redirect()`) gating each route group by the
matching role flag before Sprint 3.5 starts.

### Test matrix — confirmed how, not just "looks right"

| Case | Method | Result |
|---|---|---|
| Fresh login → session available immediately | Logged in via `/login` UI (Playwright-style browser) as `ethan@example.com`, then again via raw `curl` against `/api/auth/callback/credentials` with a real CSRF token | `Set-Cookie: authjs.session-token=...` returned on the login response; immediate `GET /api/auth/session` on the same cookie jar returns the correct user, no delay/race |
| Session "refresh" (JWT strategy, not DB strategy — see below) | Suspended the logged-in user directly via `UPDATE users SET status='suspended'`, then re-hit `/api/auth/session` with the still-valid cookie | Returned `null` body **and** `Set-Cookie: authjs.session-token=; Max-Age=0` (cookie cleared) — the `jwt` callback's per-read DB status check (`auth.ts:67-74`) works as designed |
| Logout clears session | Called `/api/auth/signout` with a valid CSRF token on an authenticated cookie jar | `Set-Cookie: authjs.session-token=; Max-Age=0`; immediate follow-up `/api/auth/session` on that jar returns `null` |
| Expired/malformed session → clean handling | Sent `Cookie: authjs.session-token=garbage.invalid.token` | `200 OK`, body `null`, cookie cleared — **not** a 500 or unhandled exception |
| Concurrent tabs, same browser (shared cookie jar) | Logged in once, signed out via one "tab" (request), then re-read session on the same shared jar (simulating a second tab's next action) | Correctly `null` — because both tabs share one browser cookie store, sign-out is reflected immediately on next request. **Caveat:** this only matters in practice if a tab's UI reflects session state, and currently none do (see below) |
| Concurrent tabs / devices, separate sessions | Logged in twice with two independent cookie jars (two distinct signed JWTs for the same user) | Signing out jar A does **not** invalidate jar B's token — expected for a stateless JWT strategy with no server-side session registry; each token lives until its own ~30-day expiry or its own sign-out. Worth knowing this is the tradeoff of the JWT-strategy decision documented in `auth.ts` |

Note on "session refresh": the sprint-plan checklist item referenced
"NextAuth's default DB session refresh," but Sprint 3 deliberately switched
to the **JWT** strategy (Credentials-only providers can't use the database
strategy — see the comment block at the top of `auth.ts`). The equivalent
JWT-strategy behavior is the per-read DB status re-check in the `jwt`
callback, tested above, not a session-table refresh.

### Where session is (and isn't) actually read

- **Route Handlers**: `/api/auth/[...nextauth]/route.ts` (the NextAuth
  handler itself) — reads/writes the session correctly, confirmed above.
- **Server Components**: none call `auth()`. Confirmed by grep and by the
  live unauthenticated-admin-dashboard test above.
- **Client Components**: `next-auth/react`'s `signIn`/`signOut`/`getSession`
  are used directly (`app/login/page.tsx`, the three navbar components' sign-
  out buttons). `useSession()` is not used anywhere, and `<SessionProvider>`
  does not wrap the app (`app/layout.tsx` has no provider). This is currently
  harmless (nothing calls the hook that needs the provider) but is a trap for
  the next person who adds `useSession()` expecting it to just work.
- **Middleware**: none exists.
- Sprint-plan note that sign-out was "unwired" in `UserNavbar`/`SupplierNavbar`
  is **stale** — confirmed all three navbars (`UserNavbar.tsx`,
  `SupplierNavbar.tsx`, `AdminNavbar.tsx`) now correctly call
  `signOut({ callbackUrl: "/login" })`.

### Cookie config (secure / sameSite / httpOnly)

No explicit `cookies` block in `auth.ts` — Auth.js v5 defaults apply.
Confirmed live on `localhost` (HTTP, dev): `authjs.session-token`,
`HttpOnly`, `SameSite=Lax`, no `Secure` flag, no `__Secure-` name prefix,
`~30 day` expiry (Auth.js default `maxAge`). That's correct *for HTTP dev*.

**Not yet confirmed against Railway production**, and this is a real gap:
- No `AUTH_URL` / `AUTH_TRUST_HOST` (or legacy `NEXTAUTH_URL`) is set in
  `.env`, `.env.example`, or anywhere in the repo. Auth.js v5 only emits the
  `Secure`-flagged, `__Secure-`-prefixed cookie when it trusts the request
  as HTTPS. Behind Railway's reverse proxy (TLS terminated at the edge,
  forwarded to the app over plain HTTP internally, similar to most non-Vercel
  hosts), Auth.js needs `AUTH_TRUST_HOST=true` (or a correct `AUTH_URL`) to
  trust `X-Forwarded-Proto` — without it, cookies may be issued without
  `Secure`, or requests may hit Auth.js's `UntrustedHost` guard.
  **Action item: set `AUTH_TRUST_HOST=true` and `AUTH_URL=https://<railway-domain>`
  in the Railway service's env vars, then re-run this same cookie check
  against the deployed URL** (`curl -i https://<domain>/api/auth/csrf`,
  confirm `Secure` + `__Secure-authjs.csrf-token` in the response) before
  Sprint 3.5 starts. This file's test above only proves the *mechanism*
  works; it does not prove the *production* cookie is actually marked Secure.

### CORS

Locally, no `Access-Control-Allow-Origin` (or any `Access-Control-*`) header
is returned from `/api/auth/session` or `/api/auth/register` even when sent
with a cross-origin `Origin` header — confirmed via `curl`. This is the safe
default (same-origin browser policy applies, nothing explicitly opened up).
Since this is a single Next.js app (API routes + pages co-located, not a
separate backend service), CORS risk is inherently low as long as that
topology holds on Railway. **Not yet confirmed against the actual deployed
Railway URL** — re-run the same cross-origin `curl` check post-deploy to
make sure no CORS headers were introduced by a proxy/CDN layer in front of
the app, and that the frontend isn't accidentally served from a different
origin than the API routes.

### Bottom line for the Sprint 3 → 3.5 gate

- ✅ Session mechanism itself (login, logout, suspension re-check, malformed-
  token handling, cookie clearing) is correct and was exercised directly,
  not assumed.
- ✅ Sign-out wiring gap from Sprint 1 is fixed.
- 🔴 **Route protection does not exist** — this is the actual blocker, not
  the cookie plumbing. Must be built (middleware or per-layout `auth()`
  guards) before this sprint can close.
- 🟡 Cookie `Secure`/`__Secure-` behavior and CORS are only verified against
  localhost HTTP; both need a second pass against the real Railway URL with
  `AUTH_TRUST_HOST`/`AUTH_URL` set, per the checklist gate.

## Sprint 3, Session 3 — CRUD: Spaces + Credentials (2026-07-19)

Built the Spaces (Listings) and read-side Credentials API routes. Manually
exercised against the seeded dev DB (`ben@acmecoworking.sg`, real login via
the credentials flow + CSRF, not just eyeballed), not just typechecked.

### Field naming: DB-column names, no translation layer

Decision (flagged per the session scope): the API request/response contract
uses the same field names as the Prisma model / DB columns throughout —
`type`, `priceDay`, `priceWeek`, `priceMonth`, `pricePerUnit`,
`stockQuantity`, `packSize` — **not** the old Laravel API's
`listing_type`/`credits_daily`/`credits_weekly`/`credits_monthly`/
`credits_per_unit`/`stock` contract (see CODEBASEAPI_SUMMARY.md §6). Applied
consistently across all new routes in `app/api/listings/`,
`app/api/supplier/listings/`, `app/api/credentials/`.

### Credentials: disambiguated via schema, scoped read-only this session

Confirmed against `prisma/schema.prisma`: "credentials" = `UserCertificate`
(earned/held record — user, certificate, earnedDate, expiryDate), mapped to
`user_certificates`, distinct from `Certificate` (the catalog/definition,
Session 4). The schema disambiguated this cleanly, no need to stop and ask.

Write access was a real open question, though: the old backend never had a
create/update endpoint for `user_certificates` (only `GET /me/certificates`,
read-own), "admin scope" is explicitly out of scope for this session, and
the actual issuance mechanism (training pass → credential) is Sprint 4's
job. Asked before building — decision: **read-only this session**. Built
`GET /api/credentials` (mine) only, mirroring the old `mine()` endpoint.
Write endpoints are Sprint 4 scope, once the issuing actor/flow is designed
alongside the training-credentialing logic, not before.

### Spaces (Listings): gaps fixed at rebuild time, not ported as-is

Per the "known gaps get fixed when rebuilt, not deferred again" ground rule,
found and fixed a real gap while re-reading `SupplierListingController`
directly (not just the summary doc): `location`, `description`, `image_url`,
`require_approval`, and `pack_size` were all fillable on the old `Listing`
model and exposed in `ListingResource`, but **never validated/settable**
through `SupplierListingController::rules()` — a supplier could never
actually set them via the old API, only via seeders. Confirmed the
already-built (mocked) `AddEditListingModal` collects location, description,
and a require-approval toggle, so this wasn't a design choice to preserve.
All five are now proper optional fields on create/update in
`app/api/supplier/listings/route.ts` and `.../[id]/route.ts`.

`is_available` also now settable directly in the create/update body (the
modal has an inline toggle for it), in addition to the dedicated
`PATCH .../[id]/availability` endpoint that mirrors the old
`toggleAvailability` route (used by the Inventory card's quick-toggle
button). Both paths write the same column, no conflict.

**Important divergence from the old system, not a bug**: this rewrite's own
`listings_pricing_matches_type` CHECK constraint (migration
`20260718171756_listings_pricing_check`, Sprint 2) requires `pack_size` to
be set for consumables — the old Laravel DB constraint did not. The
app-layer mirror in `lib/listings.ts` (`assertPricingMatchesType`) enforces
*this repo's* constraint, confirmed by reading the actual migration SQL, not
the old CODEBASEAPI_SUMMARY.md §4 description (which is a summary of the old
system's laxer version). Verified live: `POST` a consumables listing with
`pricePerUnit`+`stockQuantity` but no `packSize` → clean 422, not a raw
`23514` DB error.

No `DELETE` endpoint exists (matches the old backend — `SupplierListingController`
never had a `destroy()` either; not an oversight here, a deliberate port).

### Auth pattern for new routes

No route protection exists yet (see Session 2 above — still a Sprint 4 item),
so every supplier route calls `auth()` from `auth.ts` directly and checks
`isSupplier` + `companyId` itself (`lib/supplier-auth.ts`), same pattern as
the old `supplier` middleware (`is_supplier` only, not company-admin) plus
the `ListingPolicy::update` company-ownership check. Verified live:
cross-tenant `PATCH` on another company's listing → 403; unauthenticated
`GET /api/supplier/listings` and `GET /api/credentials` → 401.

## Sprint 3, Session 4 — CRUD: Bookings + Certificates, Approval Flow, Admin Scope (2026-07-19)

Built bookings CRUD (create/list/confirm/decline), certificate catalog +
approval flow, and platform-wide admin user scope (list, suspend, reinstate).
Manually exercised against the seeded dev DB via `curl` cookie-jar logins as
each seeded role (system admin, two suppliers in different companies, three
users), not just typechecked — including cleaning up every test artifact
afterward so the DB is back to its seeded state.

### Correction to this session's own brief

The task brief for this session stated the four certificate approval routes
(`POST /api/certificates`, `GET /api/admin/certificates/pending`, approve,
reject) were "already built per recent updates" and asked this session to
verify/confirm wiring. That wasn't the case: `git log`, `git status`, and a
filesystem search all confirmed `app/api/` had no `certificates` directory
at all before this session — nothing to verify, so all four (plus catalog
list/create) were built from scratch here.

Separately, `CODEBASE_SUMMARY.md` and `CODEBASEAPI_SUMMARY.md`, which the
"Old codebase reference" section above says already exist and should be read
first, do not exist anywhere in this repo. Went straight to the old
`spacesnap-api` source instead (`CertificateController`, `UserController`,
`BookingController`, `SupplierBookingController`, `BookingPolicy`,
`routes/api.php`), per this file's own fallback instruction ("read the
actual file from the old repo path... don't guess or invent structure").
Worth regenerating those two summary docs at some point — every session so
far has had to re-derive old-backend structure from source instead of
having it available.

### Certificates: catalog CRUD + approval flow

Built, all mirroring the old `CertificateController` routes/behavior
(reviewed source directly, see above):
- `GET /api/certificates` + `POST /api/certificates` (public approved list;
  supplier submit → status=pending)
- `GET /api/supplier/certificates/submitted` (supplier's own submissions,
  any status — old `mySubmissions`)
- `GET /api/admin/certificates` + `POST /api/admin/certificates` (admin
  catalog view with status/search filters + pagination; admin direct-create
  → source=platform, status=approved immediately — old `adminIndex`/`adminStore`)
- `GET /api/admin/certificates/pending`, `PATCH .../approve`, `PATCH .../reject`

No update/delete endpoint was added for the catalog beyond approve/reject —
the old backend never had one either (only `approve`/`reject` touch an
existing row), so none was invented here per the "never invent
routes/fields" ground rule.

### Bookings: CRUD shape only, ledger explicitly stubbed

Built `POST /api/bookings` (create), `GET /api/supplier/bookings` (list,
company-scoped, optional status filter), `PATCH
/api/supplier/bookings/{id}/confirm`, `PATCH .../decline` — mirroring old
`BookingController::store` + `SupplierBookingController`. Kept: consumables
rejection, cert-requirement existence check (not tier — tier logic is
Sprint 4, a different sprint than this session), the `23P01` exclusion-
constraint → clean 409 instead of a raw Postgres error.

**Explicitly stubbed, per this session's scope, deferred to Sprint 3.5:**
- No `credit_balance` check before creating a booking
- No debit Transaction record on create (the `credits` field is still
  computed and stored on the Booking row itself — it's a NOT NULL column —
  just never moved into the ledger)
- No Transaction record on confirm (matches the old build's behavior, which
  also never wired this — Sprint 3.5's job is to add the audit-trail row
  that never existed, not fix a regression introduced here)
- No refund Transaction on decline (the old build did create one here; this
  session's decline only flips status to `cancelled`)

Verified live: booking on non-overlapping dates → 201 with `credits`
correctly computed from the listing's per-type price; booking overlapping an
existing active booking → 409; booking a listing requiring a certificate the
user doesn't hold (or holds expired) → 422 with `missingCertificates`;
booking a listing requiring a certificate the user holds unexpired → 201;
booking a consumables listing directly → 422; supplier confirming a booking
outside their own company's listings → 403; declining an already-cancelled
booking → 422.

### Admin scope: platform-wide list + suspend/reinstate

Built `GET /api/admin/users` (role/search filters, pagination, derived role
same precedence as old `UserController::deriveRole`), `PATCH
/api/admin/users/{id}/suspend`, `PATCH .../reinstate`. Platform-wide by
design — not scoped to the caller's own company, matching both the task
brief and a comment already present in the (still-mock) frontend
`SystemAdminUsersCompanies.jsx`: "System Admin can suspend/reinstate ANY
user regardless of role... separate from Company Admin's supplier-suspend."

**Enforcement decision (explicit, per this session's brief asking not to
silently repeat the old no-enforcement gap):** partially already enforced,
partially deferred.
- **Already enforced, no new code needed:** `auth.ts`'s `jwt` callback
  re-checks `status` from the DB on every session read and forces sign-out
  when suspended (built in Sprint 3, Session 1). Every route in this
  session calls `auth()` (directly or via `requireSupplier`/
  `requireSystemAdmin`), so a suspended user's own actions — booking,
  confirming, submitting a certificate, logging in — are rejected with 401
  as soon as their current JWT is next read. **Verified live**: suspended
  `gabriel@greenpack.sg` mid-session on his still-valid cookie →
  `GET /api/auth/session` immediately returned `null`, and a follow-up
  `POST /api/bookings` on that same cookie returned 401, not a silent pass.
  This closes the old build's "suspend does nothing for login/actions" gap
  for every actor-side path built so far.
- **Still open, deferred (not silently — flagged here):** listing
  visibility. A suspended supplier's listings stay visible to other users
  browsing `GET /api/listings`, because `Listing` belongs to `Company`, not
  `User` — there's no company-level suspension concept anywhere in this
  schema. Mapping "this one user is suspended" to "hide these listings"
  requires a real product decision this session didn't have the authority to
  make unilaterally (does suspending one company-admin hide the whole
  company's listings, or only listings that user personally created — the
  schema doesn't even track listing-level ownership below the company).
  Left as an open item for whoever owns that call next, rather than guessed
  at here.

### Field naming

Followed Session 3's DB-column-camelCase-throughout decision (no Laravel-
style translation layer) for every new route: `bookingType`, `startDate`,
`missingCertificates`, `createdByCompanyId`, `reviewedBy`, etc.

### Not done this session (explicitly out of scope per the brief)

- Wiring any of Sprint 1's mock-data frontend pages (`SupplierRequests.jsx`,
  `SystemAdminUsersCompanies.jsx`, `SystemAdminCertificatesTraining.jsx`,
  `BookingModal.jsx`) to these new endpoints — the brief only asked for the
  backend routes.
- The old `BookingController::pending/approve/reject` admin-side booking
  approval flow (separate from supplier confirm/decline) — not mentioned in
  this session's scope, so not built; flag if it turns out to be needed.

## Session 5 — React Query infra + Login/Signup + client role-gating (2026-07-19)

First installment of "Connect Sprint 1 Pages to Real Endpoints + React Query"
(`SPRINT_PLAN_NEXTJS_REWRITE.md`, Sprint 3 checklist). Confirmed Sessions 1–4
are merged to `main` and the API routes they built actually exist (`app/api/`
has listings, credentials, bookings, certificates, admin/users,
admin/certificates — matches the Session 3/4 notes above) before starting.
Per this repo's own instruction to sub-session large work "one page/feature
per session," this session covered shared infra + the first page in the
suggested order (Login/Signup) and stopped there — Discover/Marketplace
onward is still mock data, not done yet.

### Shared infra (needed by every subsequent page, so built once here)

- Installed `@tanstack/react-query`. `components/Providers.tsx` wraps the app
  in `QueryClientProvider` + NextAuth's `SessionProvider` (neither existed
  before — confirmed by grep, matches the Session 2 note that
  `<SessionProvider>` was missing and `useSession()` would have been a trap).
  Mounted in `app/layout.tsx`.
- `components/RoleGuard.tsx` + `lib/role-home.ts`: client-side role gating for
  the three route-group layouts, closing the specific gap
  `CODEBASE_SUMMARY.md` flagged ("old frontend had no client role-gating on
  User/Supplier routes") per this session's explicit brief. `(user)/layout.tsx`
  requires any authenticated session, `(supplier)/layout.tsx` requires
  `isSupplier`, `(admin)/layout.tsx` requires `isSystemAdmin`. Unauthenticated
  → `/login`; authenticated but wrong role → their own role home
  (`getRoleHome`), not a blank/error page. Verified live with real seeded
  accounts (`ethan@example.com` plain user, `ben@acmecoworking.sg` supplier):
  unauthenticated hitting `/supplier` → `/login`; `ethan` hitting `/supplier`
  or `/admin/dashboard` → bounced to `/user`; `ben` hitting `/admin/dashboard`
  → bounced to `/supplier`; each role's own route group renders normally.
  **This is client-side only** — the Sprint 4 item (server-side
  `middleware.ts`/`auth()`+`redirect()` gating, see Session 2 above) is still
  open and still the real trust boundary; this just stops the UI from
  rendering/flashing role-gated content it shouldn't.

### Login/Signup

These were already wired to real endpoints as of Sprint 3 Session 1 (real
`signIn`/`/api/auth/register` calls, not mock data) — confirmed by reading the
files before touching them, so there was no mock-data swap to do here. What
this session actually added:
- Wrapped both the credentials sign-in and the register call in React Query's
  `useMutation` (replacing manual `useState` submitting/error bookkeeping) so
  the loading/error pattern is consistent with what later data-fetching pages
  will use.
- Both pages now redirect an already-authenticated user away via `useSession`
  + `getRoleHome` (previously hitting `/login` while logged in just re-showed
  the form). Verified live for all three roles.
- Login's post-sign-in redirect now goes through the shared `getRoleHome`
  helper instead of its own inline if/else chain (same logic, deduplicated
  since `RoleGuard` needed the same mapping).

Confirmed no regressions: `npx tsc --noEmit` and `eslint` clean on every
touched file; wrong-password path still shows "The provided credentials are
incorrect." inline, not a thrown/unhandled error.

### Not done this session

Discover/Marketplace, Digital Passport, Credit Wallet, User Dashboard,
Notifications, Supplier Inventory, Supplier Requests, Supplier Profile, Admin
pages — all still read from the `lib/mock*.ts` files (`mockListings.ts`,
`mockPassport.ts`, `mockWallet.ts`, `mockDashboard.ts`,
`mockSupplierDashboard.ts`, `mockRequests.ts`, `mockAdmin*.ts`, etc.), not yet
wired to the real API routes or React Query. Next session per the suggested
order: Discover/Marketplace.

## Sprint 4, Item 1 — Credential-Gating (2026-07-19)

Task brief asked to block booking creation at the API layer when the user
lacks a valid, non-expired credential for the listing's required
certificate(s), scoped strictly to the booking-creation endpoint (tier
comparison is item 2, double-booking is item 3 — both explicitly untouched).

**Finding: this was already built**, ahead of schedule, in Sprint 3 Session 4
(see that section above) — `missingCertificateIds()` in `lib/bookings.ts`
already does the exists-and-not-expired check (`OR: [{ expiryDate: null },
{ expiryDate: { gte: today } }]`), and `app/api/bookings/route.ts` calls it
before the `prisma.booking.create` write, returning a clean `422` with
`missingCertificates: [names]` rather than a raw DB error. No tier concept
exists anywhere in the schema (confirmed via repo-wide grep for "tier") —
the task brief's "required tier" language doesn't map to anything built yet,
consistent with tier logic being its own item; flagging rather than
inventing a field for it.

Did not just trust the Session 4 notes — re-verified live against the dev
server (`localhost:3000`) and the seeded DB, real cookie-jar logins via
`/api/auth/callback/credentials`, cleanup after:
- `ethan@example.com` (holds an *expired* Fire Safety Marshal cert,
  expired 2026-01-10) → `POST /api/bookings` on listing 55 (Meeting Room B,
  requires that cert) → `422 { missingCertificates: ["Fire Safety Marshal"] }`
- `farah@example.com` (holds a valid, unexpired Forklift cert) →
  `POST /api/bookings` on listing 56 (Forklift Rental, requires that cert) →
  `201`, booking created
- `ethan` → listing 57 (Power Drill Set, no certificate requirement) →
  `201` — confirms no false-positive blocking on listings with no
  requirement
- Both test bookings (ids 98, 99) deleted afterward; DB back to seeded state

No code changes were needed. Updated the Sprint 4 checklist item in
`SPRINT_PLAN_NEXTJS_REWRITE.md` to checked, with a note on why.

## Sprint 4, Item 2 — Tier Comparison Logic (2026-07-19)

Task brief asked for the tier comparison rule (achieved tier per equipment
class only increases; higher tier satisfies lower requirement; Passport
stores the highest tier achieved per class; booking flow surfaces only the
delta), as a standalone testable module — explicitly not inlined into the
booking route, and explicitly not wiring double-booking or credential-gating
(separate items).

**Confirmed before building:** no `tier` or `equipmentClass` concept exists
anywhere — re-checked `prisma/schema.prisma` directly (grep for "tier" and
"equipmentClass", zero hits beyond this), and re-confirmed the Sprint 4 Item 1
finding that the old Laravel/React repos never had this concept either (grep
across both old repos turned up nothing but Carbon locale-file noise
containing the substring "tier"). This is genuinely new domain logic for this
sprint, not something to port, and not something to invent new schema/columns
for unilaterally.

**What was built:** `lib/tiers.ts` — pure functions, no Prisma/DB dependency,
operating on plain `{ equipmentClass, tier }` values so the eventual decision
of *which* schema field carries equipmentClass/tier (likely `Certificate`,
since it already has a `category` string that could double as equipment
class, but that's a real product decision, not guessed here) stays a separate
wiring step:
- `computePassportTiers(records, asOf)` — aggregates raw achievement records
  into the Passport's per-equipment-class highest *currently valid* tier;
  expired records contribute nothing but never remove a still-valid tier
  earned elsewhere.
- `recordTierAchievement(passport, equipmentClass, tier)` — returns a new
  Passport with the tier raised to `max(current, new)`, immutably; a lower or
  equal new achievement never decreases what's already recorded.
- `meetsTierRequirement(achieved, required)` — `achieved >= required`; higher
  always satisfies lower, never the reverse.
- `compareTiers(passport, requirements)` — returns `{ satisfied, gaps }`
  where `gaps` contains only the unmet equipment classes (required tier +
  achieved tier, defaulting to 0 for "no credential"), so a caller only ever
  sees the delta, not a full re-explanation of requirements already met.

**Tests:** `lib/tiers.test.ts`, 22 cases via `node:test`/`tsx --test` (no DB
needed — pure functions), covering the Sprint 4 checklist's named edge cases
(equal tier, higher tier, no credential, expired credential) plus immutability,
multi-class independence, and the "surfaces only the delta" behavior
specifically (a satisfied requirement is absent from `gaps`, not present-and-
marked-ok). Added `lib/tiers.test.ts` to the `npm test` script alongside the
existing `prisma/tests/db-constraints.test.ts`. Verified: `npm run lint` (via
`npx eslint lib/tiers.ts lib/tiers.test.ts`) and `npx tsc --noEmit` both clean;
`npx tsx --test lib/tiers.test.ts` → 22/22 pass.

**Not done, per the brief's explicit scope:** not wired into
`app/api/bookings/route.ts` or `missingCertificateIds` in `lib/bookings.ts` —
that requires the schema decision above (what actually carries
equipmentClass/tier) and touches double-booking/credential-gating territory
this item was told to leave alone. Flagging as the natural next step once
that schema call is made.

## Sprint 4, Item 2 (revised) — Tier Comparison Scrapped, Replaced With Certificate-Set Gating (2026-07-19)

**The numeric-tier model above was wrong.** It was built on an unconfirmed
assumption — "achieved tier per equipment class only increases" — invented
because nothing in the schema said otherwise and the task brief used the word
"tier" without defining it. Confirmed with the product owner this session:
**there is no numeric tier progression anywhere in this product.** "Tier" is
just a label for *how* a given certificate was earned, not a level of
achievement one certificate can outrank another on. The three earning paths
are:
- Tier 1: self-serve video + quiz
- Tier 2A: some validation requiring operator sign-off
- Tier 2B: training requiring operator OR external SME sign-off

Every path produces exactly the same kind of result — a row in
`user_certificates`. There is no "Tier 2 forklift cert satisfies a Tier 1
forklift requirement" relationship, because there's no such thing as two
different forklift certs at two different tiers in the first place. Each
certificate just *has* an earning method.

**If you're reading this in a future session:** do not re-derive the tier-
comparison model from the task brief's language again. The word "tier" in
this codebase refers to `certificates.earning_method`, a label, not a level.
Booking-gating logic is a plain set difference (required certificates minus
held-and-not-expired ones), nothing more — see `lib/certificate-gating.ts`.

**What changed, concretely:**
- Deleted `lib/tiers.ts` and `lib/tiers.test.ts` entirely (clean redo, not a
  patch — confirmed via grep afterward that nothing else imported them).
- Added `certificates.earning_method` (new enum `CertificateEarningMethod`:
  `tier1_video_quiz` / `tier2a_operator_signoff` /
  `tier2b_operator_or_sme_signoff`), via a real migration
  (`prisma/migrations/20260719064218_add_certificate_earning_method`), not
  just a schema.prisma edit. Deliberately **not** reusing/overloading
  `certificates.category` — that's a different, existing classification
  (safety/equipment/house-rules per CODEBASE_SUMMARY.md), and conflating the
  two was a mistake already flagged in that doc. Column is `NOT NULL DEFAULT
  'tier1_video_quiz'` since the table already had 5 seeded rows; seed script
  updated to set an explicit, plausible `earningMethod` per seeded
  certificate rather than leaving all five on the default.
- New pure module `lib/certificate-gating.ts` (not `lib/certificates.ts` —
  that name is already taken by the existing certificate-catalog CRUD module
  from Sprint 3 Session 4, which is Prisma-backed; this module deliberately
  stays DB-free, same "pure, unit-testable without a DB" pattern the scrapped
  `lib/tiers.ts` used). One function: `getMissingCertificates(requiredCertificateIds,
  userHeldCertificates, asOf?)` — plain set difference, required minus
  (held AND not expired). No scoring, no achieved-vs-required comparison.
- `missingCertificateIds` in `lib/bookings.ts` now fetches required/held ids
  from Prisma and delegates the actual diff decision to
  `getMissingCertificates`, instead of inlining the `Set` logic itself. The
  booking route (`app/api/bookings/route.ts`) needed no changes — it already
  surfaced `missing` as `missingCertificates: [names]` on a 422, which is
  exactly "surface only the delta," just backed by a set difference instead
  of a tier comparison now.
- `lib/certificate-gating.test.ts`: 7 cases via `node:test`, covering holds-
  all (pass), missing-one-of-several, holds-none, expired-treated-as-missing,
  and no-certs-required (trivially passes) — the exact matrix asked for.
  `npm test` script updated to point at this file instead of the deleted
  `lib/tiers.test.ts`.

**Verified live**, not just unit-tested: re-ran `prisma/seed.ts` after the
migration (5 certs, ids renumbered — 34–38 this run), then via real
cookie-jar logins against the dev server: `ethan@example.com` (holds cert 36,
Fire Safety Marshal, expired 2026-01-10) → `POST /api/bookings` on listing
111 (Meeting Room B, requires cert 36) → `422
{"missingCertificates":["Fire Safety Marshal"]}`, confirming the expired-
counts-as-missing rule still holds after the refactor. `farah@example.com`
(holds a valid Forklift cert) → `POST /api/bookings` on listing 112 (Forklift
Rental, requires that cert) → `201`, booking created, then deleted afterward
to leave the DB back at its seeded state.

**Explicitly out of scope this session** (per the brief): the actual booking
route wasn't touched beyond confirming `missingCertificateIds` still gates
correctly (that's item 1 territory, already closed); no submit/review/
sign-off flow for *earning* a certificate via any of the three methods was
built (that's item 4, training/credentialing flow, still open in the sprint
plan).

## Sprint 4, Item 3 — Double-Booking Prevention, End-to-End (2026-07-19)

Task brief: the Sprint 2 exclusion constraint (`bookings_no_overlap`, 23P01)
already rejects overlapping bookings at the DB level, but that's not
sufficient alone — needed an app-layer check before insert that returns a
clean error, plus explicit handling of the race where the app-layer check
passes but the DB constraint still fires.

**Finding before writing anything:** the 23P01 → clean 409 catch already
existed in `app/api/bookings/route.ts` (built in Sprint 3 Session 4, per that
section above: "kept... the `23P01` exclusion-constraint → clean 409 instead
of a raw Postgres error"). What was actually missing was the *proactive*
app-layer check — the common case still relied on a DB exception it happened
to already handle cleanly, not the "before insert" check the item asked for.

**What was built:**
- `hasOverlappingBooking(listingId, startDate, endDate)` in `lib/bookings.ts`
  — a plain Prisma query mirroring the exclusion constraint's exact
  semantics (read from the migration SQL directly, not assumed): same
  listing, status other than `cancelled` still holds the slot, inclusive
  date bounds on both ends (`startDate <= endDate AND endDate >= startDate`
  against the existing row, matching `daterange(..., '[]') &&`).
- `BOOKING_OVERLAP_MESSAGE` constant, also in `lib/bookings.ts`, shared
  between the new app-layer check and the existing 23P01 catch so both paths
  return byte-identical text — the race case shouldn't read differently from
  the common case.
- `app/api/bookings/route.ts`: calls `hasOverlappingBooking` right before
  `prisma.booking.create`, returns `409` immediately if it finds a conflict.
  The existing try/catch around the insert is unchanged in structure, just
  now references the shared message constant.

**Tests:** `lib/bookings.test.ts` (new, real dev DB via Prisma, same
integration-test convention as `prisma/tests/db-constraints.test.ts`) — 5
cases: detects overlap, inclusive boundary-day overlap, genuinely
non-overlapping dates, cancelled bookings don't block, overlap on one listing
doesn't block a different listing. Added to the `npm test` script. `npx tsc
--noEmit` and `npx eslint` both clean.

**Verified live, not just unit-tested** — real cookie-jar login as
`ethan@example.com` against the dev server and listing 113 (Power Drill Set,
no cert requirement, so nothing else could interfere):
- Booking `2028-01-10`–`2028-01-12` → `201`.
- Overlapping `2028-01-11`–`2028-01-14` on the same listing → clean `409
  {"message":"This listing is not available for the selected dates."}`, not
  a raw Postgres error — this is the app-layer check firing, confirmed by
  timing (no DB round-trip exception involved).
- Non-overlapping `2028-02-01`–`2028-02-03` on the same listing → `201`
  (confirms no false-positive blocking).
- **Race condition specifically exercised**, not just asserted to work: fired
  5 concurrent `POST` requests at the identical new slot
  (`2028-03-05`–`2028-03-07`) via backgrounded `curl` + `wait`, so all 5 hit
  the app-layer `SELECT` before any of their inserts landed. Result: exactly
  one `201`, the other four all `409` with the identical shared message —
  meaning those four *did* pass the app-layer check (by design, since they
  raced) and were caught by the DB constraint's 23P01 on insert, translated
  through the same clean-message path. This is the actual race scenario the
  task brief asked to prove, not a hypothetical.
- All 6 test bookings deleted afterward (raw SQL `DELETE ... WHERE id IN
  (...)`, confirmed 0 remaining); DB back to seeded state.

**Not touched:** no other booking-creation path exists in this codebase
(supplier confirm/decline only transition status on existing rows, they
don't insert), so this was the only place the check was needed.

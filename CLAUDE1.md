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

## Sprint 3.5, Known Gap #1 — Booking-Creation Ledger, Atomic (2026-07-19)

Task brief: wrap booking creation in a single DB transaction that checks
`credit_balance >= cost`, rejects with a clean 4xx if insufficient (not a
raw DB error), creates the Booking, decrements `credit_balance`, and creates
a debit Transaction row — closing the gap Sprint 3 Session 4 explicitly
stubbed (see that section above).

**Correction to the brief's own wording, confirmed against schema before
building:** there is no `credit_balance` column anywhere — grepped
`prisma/schema.prisma` directly. The `Transaction` model's own comment
states the design intentionally: *"balance is always SUM(amount) WHERE
user_id = ?, never stored denormalized."* `prisma/seed.ts` already follows
this (signed `amount`, `type: booking` for debits, negative for spend,
positive for topup/refund). So "decrement credit_balance" here means
*create a negative-amount Transaction row* — there's no column to
decrement. Not a deviation from the brief's intent, just its literal
wording not matching the schema (same category of correction as the Sprint
4 Item 2 tier-model rewrite above — check schema before trusting a brief's
noun for a thing).

**What was built**, both in `lib/bookings.ts`:
- `getCreditBalance(userId, client?)` — `SUM(Transaction.amount)` for the
  user, live, never cached/stored. Accepts either the top-level `prisma`
  client or a `$transaction` callback's `tx` client, so it can be read
  inside the same transaction as the write below without a stale value.
- `createBookingWithDebit(params)` — opens one `prisma.$transaction`:
  reads balance via `getCreditBalance(userId, tx)`, throws
  `InsufficientCreditBalanceError` if `balance < cost` (rolls back
  automatically, nothing written), otherwise creates the `Booking` row and
  a `Transaction` row (`type: booking`, `amount: cost.negated()`,
  `bookingId` set) in the same transaction.

`app/api/bookings/route.ts` now calls `createBookingWithDebit` instead of
`prisma.booking.create` directly, and catches `InsufficientCreditBalanceError`
→ `422 { errors: { credits: [...] } }`, same `ApiValidationError` shape as
every other validation rejection in this route — not a raw constraint
error, matching the brief. Cert-gating, overlap check (`hasOverlappingBooking`,
Sprint 4 Item 3), and consumables rejection are all unchanged and still run
*before* this transaction opens, per the brief's explicit scope boundary —
the existing 23P01 → 409 catch (race between the overlap pre-check and the
insert) still wraps the whole call and still works, since the constraint
fires on the same `tx.booking.create` either way.

**Known, explicitly out-of-scope gap, not silently missed:** this is not
serializable-isolation — two concurrent requests from the same
near-empty-balance user could both read a sufficient balance before either
commits (the credit-balance analog of the double-booking race Sprint 4 Item
3 closed with a real DB exclusion constraint). There is no equivalent
DB-level non-negative-balance constraint in this schema yet. The brief
asked specifically for one-transaction atomicity between the three writes,
not concurrency hardening across requests — flagging the gap rather than
either silently leaving it or silently expanding scope to fix it.

**Tests:** `lib/bookings.test.ts`, 4 new cases (real dev-Postgres via
Prisma, same convention as the existing overlap tests in this file) —
zero-balance rejected with nothing written, short-by-a-cent rejected,
exact-balance-match succeeds (balance to `0`, one Transaction row), and
balance-with-room-to-spare succeeds (balance decremented by exactly the
cost, exactly one debit Transaction row alongside the unrelated topup row
already in the ledger). All 27 tests in `npm test` pass (5 overlap + 4 new
ledger + 7 cert-gating + 4 overlap-constraint + 5 pricing-check + 2
company-admin-check), confirming no regression to the untouched
cert-gating/overlap logic.

**Verified live**, not just unit-tested — real cookie-jar logins against
the dev server and dev DB (`ethan@example.com`, `farah@example.com`),
listing 113 (Power Drill Set, no cert requirement, so nothing else could
interfere), balances read directly from the DB before/after via a scratch
script (deleted afterward, not committed):
- `ethan` (ledger balance 80) → `POST /api/bookings` on listing 113,
  `2029-01-10`, daily (cost 25) → `201`; balance confirmed `55` afterward;
  exactly one `Transaction` row (`type: booking`, `amount: -25`,
  `bookingId` matching the new booking) confirmed via direct query.
- `farah` (ledger balance already `-520` from seeded data, pre-existing —
  not something this session induced) → `POST /api/bookings` on listing
  113, `2029-02-10`, daily → clean `422
  {"errors":{"credits":["Insufficient credit balance for this booking."]}}`,
  not a raw DB error; confirmed zero `Booking`/`Transaction` rows written
  for the attempt and balance unchanged at `-520`.
- Test booking (`ethan`, id 130) and its Transaction row deleted afterward;
  re-queried balance back to `80`, confirming DB is back to seeded state.

**Not touched, per the brief's explicit scope:** booking confirm's
Transaction record and booking decline's refund Transaction (Sprint 3.5's
own checklist lists these as separate, still-open items) and bulk-order
pricing/balance — none of these were asked for here and none were built.

## Sprint 3.5, Known Gap #2 — Booking-Confirm Audit Transaction (2026-07-19)

Task brief's own wording ("the original build silently deducted credits on
confirm with no audit trail") assumes the old build moved money at confirm
time. Checked that assumption against both this design and the old Laravel
source before writing anything, per the brief's explicit instruction to
state a read rather than guess:

- **This design**: credits are already fully debited at booking *creation*
  (`createBookingWithDebit`, Known Gap #1 above) inside one DB transaction
  with the Booking insert.
- **Old build**: read `BookingController::store` and
  `SupplierBookingController::confirm` directly
  (`~/Documents/spacesnap-api`). Same shape — `store()` creates the debit
  Transaction; `confirm()` only ever did `$booking->update(['status' =>
  'confirmed'])`, no Transaction, ever. `decline()`, by contrast, does sum
  the booking's existing debit Transactions and creates a refund if
  negative — that's a real, distinct gap (Known Gap #3, still open, not
  touched here).

So the brief's "silently deducted on confirm" framing doesn't match either
codebase — nobody ever deducted at confirm. The actual, correctly-scoped
gap is just what Session 4 documented: confirm produced no audit trail at
all for the (already-fully-recorded) create-time debit. Building a second
debit here would double-charge the user for one booking; the brief itself
flagged this risk ("don't invent a double-deduction").

**What was built:** `confirmBookingWithAudit(bookingId)` in `lib/bookings.ts`
— one `prisma.$transaction` that re-reads the booking's status (guards
against a stale read between the route's ownership check and this call),
throws `BookingNotConfirmableError` if not `pending`, otherwise updates
status to `confirmed` and creates a **zero-amount** `Transaction` row
(`type: booking`, `bookingId` set, description noting the debit already
happened at creation). Zero-amount because it's a real ledger row —
`SUM(Transaction.amount)` stays correct — but represents no actual credit
movement, matching the audit-trail-not-a-charge intent.

Worth noting: `prisma/seed.ts`'s "confirmed booking" fixture (`farah`,
Forklift Rental) already seeded exactly this shape — a `-950.00` create
debit plus a `0.00` "Booking confirmed by supplier" row — before this
session touched any code. That's independent confirmation this read
matches the schema's own design intent (the `Transaction` model's comment
lists "booking confirm" as a distinct credit-affecting event from "booking
create debit," not a second charge).

`app/api/supplier/bookings/[id]/confirm/route.ts` now calls
`confirmBookingWithAudit` instead of a bare `prisma.booking.update`, and
catches `BookingNotConfirmableError` → clean `422` (previously this route
had no status guard at all — confirming an already-confirmed or cancelled
booking silently re-ran the update).

**Tests:** `lib/bookings.test.ts`, 3 new cases — pending booking confirms
with exactly one zero-amount Transaction row; confirming an
already-confirmed booking rejects with `BookingNotConfirmableError` and
writes no second row; confirming a cancelled booking rejects and writes no
orphan row. All 30 tests in `npm test` pass (no regression to the 27 from
before).

**Verified live**, not just unit-tested — real cookie-jar logins against
the dev server/DB: `ethan@example.com` booked listing 113 (Power Drill Set,
no cert requirement) for `2029-05-05` → `201`, booking id `131`, ledger
debit `-25.00` confirmed. `divya@toolshare.sg` (ToolShare supplier)
confirmed booking 131 → `200`, status `confirmed`; direct query on
`transactions` showed exactly two rows for `booking_id=131`: the `-25.00`
create debit and a new `0.00` confirm-audit row with the expected
description. Re-confirming the same booking as `divya` → clean `422
{"message":"Booking is already confirmed and cannot be confirmed."}`, and
the transaction count for that booking stayed at `2` (no duplicate).
Booking 131 and both its Transaction rows deleted afterward; ethan's ledger
balance re-confirmed back to `80`, DB back to seeded state.

**Not touched, per Sprint 3.5's own checklist:** booking decline's refund
Transaction (Known Gap #3) and bulk-order pricing/balance — separate,
still-open items.

## Sprint 3.5, Known Gap #5 — Wallet Top-Up, `type: topup` Transaction (2026-07-19)

**Correction to the brief's own framing, confirmed before building anything:**
the brief (and the sprint plan checklist item it quotes verbatim) says
`type: purchase` transactions are "only ever seeded for demos," and guesses
the fix lives in the Credit Wallet top-up flow. Both halves needed checking
before writing code:

- `type: purchase` is **not** actually an open gap — `createBulkOrderWithDebit`
  (`lib/bulk-orders.ts`, Known Gap #4, already committed) creates a real
  `type: purchase` row on every bulk order request, and `lib/bulk-orders.test.ts`
  already asserts on it. Grepping confirmed no other `TransactionType.purchase`
  writer is missing.
- The `Transaction` model's own schema comment is explicit that
  `topup`/`refund` are credit-direction and `booking`/`purchase` are
  debit-direction. A wallet top-up is money coming in, so it belongs on
  `type: topup`, not `purchase` — using `purchase` for a top-up would
  contradict the schema's own documented semantics.
- Grepping `TransactionType.topup` across the app found it used only in
  `prisma/seed.ts` and test fixtures (`lib/bookings.test.ts`,
  `lib/bulk-orders.test.ts`) — never by a real request path. That's the
  actual, still-open version of this gap, and it matches the Sprint 3.5
  "Checklist before moving to Sprint 4" line verbatim: "every credit-affecting
  action (book, confirm, decline, bulk order, **top-up**) has a corresponding
  Transaction record."
- Confirmed the Top Up modal (`components/TopUpCreditsModal.tsx`) is exactly
  as mock as flagged: package buttons just set local state, the custom-amount
  `Input` has no `onChange`, and "Confirm Purchase" has no `onClick` at all —
  no endpoint to wire it to existed before this session.
- Stripe question: grepped for Stripe SDK usage — none exists outside seed
  data (`stripeConnectAccountId`/`stripeCustomerId`/`stripePaymentIntentId`
  are schema columns only, Sprint 6 still unbuilt per the sprint plan). So
  this is **credits-only for now**, same as every other credit-affecting
  path in this rewrite so far — no real charge happens, `stripePaymentIntentId`
  stays `null` until Sprint 6 wires an actual payment intent ahead of this call.

**What was built:**
- `lib/wallet.ts` — `parseTopUpFields(body)` (positive-number validation,
  same `ApiValidationError` shape as every other parse-fields helper) and
  `createTopUp(userId, amount)`, which creates a `type: topup` Transaction
  (`amount` positive, no balance check needed since credit-direction writes
  can't go negative) inside a `prisma.$transaction` and returns the freshly
  computed live balance (`getCreditBalance`, `lib/credits.ts` — reused as-is,
  no changes to that file).
- `app/api/wallet/topup/route.ts` — `POST`, auth-gated like every other
  mutating route in this app, `422` on invalid/non-positive amount, `201`
  with `{ transaction, balance }` on success.
- Frontend **not** wired in this session — every Sprint-1 mock page
  (`app/(user)/wallet/page.tsx` included) is still on `MOCK_*` data pending
  the separate, still-unchecked Sprint 3 checklist item "Connect all Sprint 1
  pages to real endpoints (replace mock data)." Wiring one page's modal here
  would be inconsistent with every other still-mock page and out of this
  gap's scope (the gap is "purchase/topup not created by app code," not
  "frontend not wired").

**Tests:** new `lib/wallet.test.ts` (added to `npm test`), 7 cases — 4 for
`parseTopUpFields` validation (missing/zero/negative/non-numeric amount
rejected, valid positive amount accepted) and 3 for `createTopUp` against the
real test DB (first top-up from a zero balance, a second top-up adding to
rather than overwriting the existing balance, and a decimal amount like
`49.99` preserved exactly). All 45 tests in `npm test` pass (no regression to
the 38 from before).

**Verified live**, not just unit-tested — real cookie-jar login against the
dev server/DB as `ethan@example.com` (seeded ledger balance `80`):
`POST /api/wallet/topup {"amount": 49.99}` → `201
{"transaction":{"type":"topup","amount":49.99,...},"balance":129.99}`; direct
query confirmed exactly one new `transactions` row (`type: topup`, amount
`49.99`) and the ledger `SUM` at `129.99`. Same request with no session
cookie → clean `401`. `{"amount": -5}` and `{}` → clean `422
{"errors":{"amount":["amount must be a positive number."]}}`. Test row
deleted afterward; ethan's balance re-confirmed back to `80`, DB back to
seeded state.

**Not touched:** the check-ins/activity-log/training-enrollments schema
items and the frontend-wiring checklist item both remain separate, still-open
lines in the sprint plan.

## Sprint 3.5, New Schema Item — `check_ins` Table + Controller (2026-07-19)

Task brief's own wording flagged this as an open product decision, not
something to guess: "the old app never had a working controller for this...
This sprint should decide whether check-in updates booking status." Stated a
read and got it confirmed before writing any code, per the brief's explicit
instruction.

**The read, confirmed:** `BookingStatus` already has `active` and `completed`
enum values (`schema.prisma`) that no code path anywhere had ever written —
grepped the whole app before proposing this, confirmed only
`pending`/`confirmed`/`cancelled` were ever set by real code. The mock
dashboard (`lib/mockDashboard.ts`'s `CheckIn` type, `app/(user)/user/page.tsx`'s
"active check-ins" widget) already assumes a real check-in concept with
exactly this table shape. So: check-in flips a `confirmed` booking to
`active`; check-out flips `active` to `completed`; check-in with no
`bookingId` (a bare presence log, e.g. a supplier logging a walk-in) never
touches booking status at all, since `booking_id` is nullable on `check_ins`
for exactly that reason.

**What was built:**
- `prisma/schema.prisma` — `CheckIn` model (`check_ins` table): `userId`,
  `listingId`, `bookingId` nullable, `checkedInAt` (default now), `checkedOutAt`
  nullable. Relations added to `User`, `Listing`, `Booking`. Migration
  `20260719103825_add_check_ins`, applied to both the dev and test DBs.
- `lib/check-ins.ts` — `parseCheckInFields`, `serializeCheckIn`,
  `createCheckIn` (atomic: re-checks booking status inside the `$transaction`
  before flipping it, same shape as `confirmBookingWithAudit`/
  `declineBookingWithRefund`), `checkOutCheckIn` (same pattern, flips
  `active`→`completed`). Three typed errors mirroring the existing
  `BookingNotConfirmableError`/`BookingNotDeclinableError` style:
  `BookingNotCheckInableError`, `BookingNotCheckOutableError`,
  `CheckInAlreadyCheckedOutError`.
- `app/api/check-ins/route.ts` (`POST`) and
  `app/api/check-ins/[id]/check-out/route.ts` (`PATCH`) — both auth-gated via
  `auth()`, same as the bookings routes (no supplier/kiosk auth here — that's
  explicitly Sprint 5's scope per the brief, not built). Ownership is checked
  in the route before calling into `lib/check-ins.ts`: a `bookingId` must
  belong to the requesting user and match the given `listingId`, else `403`/
  `422`; a check-out targeting someone else's check-in is `403`.
- No Transaction rows — check-in/out isn't a credit-affecting event, unlike
  confirm/decline.

**Tests:** new `lib/check-ins.test.ts` (added to `npm test`), 8 cases against
the real test DB — bare check-in writes no booking side effect; check-in on a
`confirmed` booking flips it to `active`; check-in on `pending` or already-
`active` bookings rejects cleanly with no orphan row; check-out on a bare
check-in just stamps `checkedOutAt`; check-out on an `active`-linked booking
flips it to `completed`; double check-out rejects; check-out when the linked
booking was moved out of `active` out-of-band (e.g. supplier cancels
mid-stay) rejects via `BookingNotCheckOutableError`. All 53 tests in `npm
test` pass (no regression to the 45 from before). `npx tsc --noEmit` and
`npx eslint` both clean.

**Verified live**, not just unit-tested — real cookie-jar logins against the
dev server/DB, `ethan@example.com` and `farah@example.com`, a scratch
`confirmed` booking (id 133, listing 110 "Studio Space A", no cert
requirement so nothing else could interfere):
`POST /api/check-ins {"listingId":"110","bookingId":"133"}` as ethan → `201`;
direct query confirmed booking 133 flipped to `active`. Repeating the same
call → clean `422 {"message":"Booking is active and cannot be checked in."}`.
`PATCH /api/check-ins/1/check-out` as ethan → `200`, `checkedOutAt` set;
direct query confirmed booking 133 flipped to `completed`. Repeating the
check-out → clean `422 {"message":"This check-in has already been checked
out."}`. Farah (a different user) attempting `PATCH
/api/check-ins/1/check-out` or `POST /api/check-ins` against ethan's booking
133 → both `403 {"message":"You do not have access to..."}`. No session
cookie → `401`. Test check-in and booking rows deleted afterward, DB back to
seeded state.

**Not touched, per the brief's explicit scope:** kiosk/middleware auth
(Sprint 5), and the `activity_log`/`training_enrollments` schema items remain
separate, still-open lines in the sprint plan.

---

## Sprint 3.5, New Schema Item — `activity_log` Table + Write-Path Hooks (2026-07-19)

Brief's own wording: hook logging calls into the actions this sprint already
touches "so the log actually gets populated by real app code, not left empty
like the type:purchase gap this sprint is fixing elsewhere," and "confirm
action_type values against what's actually happening rather than inventing a
taxonomy." No feed UI this session — schema + write-path only.

**Taxonomy, confirmed against the actual write-paths, not invented ahead of
them:** grepped `lib/bookings.ts`, `lib/bulk-orders.ts`, `lib/wallet.ts`, and
`lib/check-ins.ts` for every credit- or status-affecting event a real request
can trigger this sprint. Seven distinct events, seven `ActivityActionType`
enum values — one per event, not a generic `booking` bucket, so the eventual
feed can render a row without re-deriving what happened from the description
string: `booking_created`, `booking_confirmed`, `booking_declined`,
`bulk_order_created`, `wallet_topup`, `check_in`, `check_out`.

**What was built:**
- `prisma/schema.prisma` — `ActivityLog` model (`activity_log` table):
  `userId`, `actionType` (new `ActivityActionType` enum), `description`,
  `relatedListingId` nullable (not every action ties to a listing —
  `wallet_topup` doesn't), `createdAt` only, no `updatedAt` — rows are
  append-only, never edited after insert, unlike every other model in this
  schema. Relations added to `User` and `Listing`. Migration
  `20260719105326_add_activity_log`, applied to both the dev and test DBs.
- One `tx.activityLog.create` added inside each of the six existing
  `$transaction` callbacks that already do the credit-ledger or status work,
  so the log write is atomic with the action it describes — same pattern the
  Transaction rows already use, never a separate non-transactional write:
  `createBookingWithDebit`, `confirmBookingWithAudit`,
  `declineBookingWithRefund` (`lib/bookings.ts`, three log rows —
  `booking_created`/`booking_confirmed`/`booking_declined`),
  `createBulkOrderWithDebit` (`lib/bulk-orders.ts`, `bulk_order_created`),
  `createTopUp` (`lib/wallet.ts`, `wallet_topup`), `createCheckIn` and
  `checkOutCheckIn` (`lib/check-ins.ts`, `check_in`/`check_out`).

**Not done, per the brief's explicit scope:** no feed UI, no new dedicated
unit-test file for `activity_log` itself — verification was live, per the
brief's own instruction, not a new test suite.

**Verified live**, not just by re-running the existing suite: full `npm test`
still 53/53 green (no regression — the new inserts only add a row alongside
each action's existing writes, they don't change any existing assertion's
shape). Then, against the real dev DB, logged in as `ethan@example.com` and
drove all seven actions end-to-end through the real routes — wallet top-up,
two bookings created (one to confirm, one to decline) on listing 110 "Studio
Space A", the first confirmed and the second declined by
`ben@acmecoworking.sg` (listing 110's supplier), a check-in and check-out
against the confirmed booking, and a bulk order on listing 114 "Compostable
Packaging Boxes." Queried `activity_log` directly afterward: exactly 8 rows
(the extra one is the second `booking_created` from the decline-path
booking), one per real write, correct `action_type`, `related_listing_id`,
and description on every row. Scratch rows (`activity_log`, `check_ins`,
`bulk_order_requests`, `transactions`, `bookings`) deleted afterward, DB back
to seeded state.

## Sprint 3.5, Known Gap #3 — Booking-Decline Refund Transaction (2026-07-19)

No session write-up was committed alongside the code for this gap (commit
`1ebcc5e`) — backfilling it now during the Sprint 3.5 end-to-end re-verify
pass, since the sprint plan checklist still showed it unchecked despite the
code and tests existing.

**What was built:** `declineBookingWithRefund(bookingId)` in `lib/bookings.ts`
— one `prisma.$transaction`: re-reads the booking, throws
`BookingNotDeclinableError` unless status is `pending` or `confirmed` (mirrors
the old `SupplierBookingController::decline`'s allowed-status set), updates
status to `cancelled`, and creates a `type: refund` Transaction row for
exactly `booking.credits` — the amount actually debited at creation
(`createBookingWithDebit`), not a re-derived price, so a listing price change
after booking can't skew the refund. `app/api/supplier/bookings/[id]/decline/route.ts`
calls this instead of a bare status update and catches
`BookingNotDeclinableError` → clean `422`.

**Tests:** `lib/bookings.test.ts`, 4 cases — declining a `pending` booking
refunds exactly the create-time debit with one refund row; a `confirmed`
booking can still be declined and refunded; declining an already-`cancelled`
booking rejects cleanly with no ledger touch; declining twice rejects the
second call with no second refund. All pass in `npm test`.

**Verified live** (2026-07-19, this session) — real cookie-jar login as
`ethan@example.com`, booking created on listing 149 "Power Drill Set" (no
cert requirement), confirmed by `divya@toolshare.sg` (listing 149's
supplier), then declined by the same supplier. Direct query on `transactions`
for that booking showed exactly three rows: `-25.00` create debit, `0.00`
confirm-audit, `25.00` refund — and `ethan`'s live ledger balance
(`SUM(amount)`) was back to exactly `80`, matching pre-test state. Booking and
all three Transaction rows deleted afterward.

## Sprint 3.5, Known Gap #4 — Bulk Order Pricing + Atomic Debit (2026-07-19)

No session write-up was committed alongside the code for this gap (commit
`659bf75`) either — backfilling it now for the same reason as Known Gap #3
above.

**What was built:** `createBulkOrderWithDebit(params)` in `lib/bulk-orders.ts`
— same "check balance inside the transaction, insert, debit" shape as
`createBookingWithDebit`, reusing `assertSufficientBalance` (`lib/credits.ts`)
rather than reimplementing the check. Cost is computed in the route
(`app/api/bulk-order-requests/route.ts`) as `listing.pricePerUnit *
quantity`, rejecting up front if the listing isn't `consumables` or has no
per-unit price set (mirrors old `BulkOrderRequestController::store`). Unlike
the old build, which only deducted credits on transition to `fulfilled`, this
debits at request-creation time — same point bookings debit at — inside one
`$transaction` with the `BulkOrderRequest` insert and a `type: purchase`
Transaction row.

**Tests:** `lib/bulk-orders.test.ts`, 4 cases mirroring the booking-debit
suite — zero balance rejected with nothing written, short-by-any-amount
rejected, exact-balance-match succeeds (one `type: purchase` debit row),
balance-with-room-to-spare succeeds. All pass in `npm test`.

**Verified live** (2026-07-19, this session) — `ethan@example.com`, listing
150 "Compostable Packaging Boxes" (`price_per_unit` = 18.50, company 115).
First attempt at quantity 3 (cost 55.50) against a balance of 55 → clean `422
{"errors":{"credits":["Insufficient credit balance for this request."]}}`,
confirmed zero `bulk_order_requests`/`transactions` rows written for the
attempt. Topped up 50 (balance → 130), retried quantity 3 → `201`, `credits:
55.5`; direct query confirmed one `transactions` row (`type: purchase`,
`amount: -55.50`, `bulk_order_request_id` matching) and `55.50 = 18.50 × 3`
exactly. Scratch rows deleted afterward.

## Sprint 3.5, New Schema Item — `training_enrollments` Table + Enroll/Status-Update Endpoints (2026-07-19)

No session write-up was committed alongside the code for this item (commit
`a004f80`) — backfilling it now for the same reason as Known Gaps #3/#4
above.

**What was built:**
- `prisma/schema.prisma` — `TrainingEnrollment` model (`training_enrollments`
  table): `userId`, `trainingSessionId`, `status`
  (`TrainingEnrollmentStatus` enum: `enrolled`/`awaiting_signoff`/`completed`/
  `cancelled`, `@default(enrolled)`), unique on `(userId, trainingSessionId)`.
  Migrations `20260719111214_add_training_enrollments` and
  `20260719111243_activity_action_type_add_training_enrolled` (the latter adds
  the `training_enrolled` `ActivityActionType` value used below). Not a
  credit-affecting event — no Transaction row, only an `activity_log` row.
- `lib/training-enrollments.ts` — `parseEnrollFields`, `hasExistingEnrollment`
  (app-layer pre-check mirroring the `bookings_no_overlap`/overlap-check
  idiom), `enrollUser` (creates the row + an `activity_log` row in one
  `$transaction`; catches the DB's own P2002 unique-constraint violation for
  the race window and re-surfaces it as the same clean `AlreadyEnrolledError`
  the pre-check throws), `updateEnrollmentStatus` (rejects setting status back
  to `enrolled` — that value is only ever set by the model default at
  creation, there's no supported path back to it).
- `app/api/training-enrollments/route.ts` (`POST`, enroll — auth-gated, `409`
  on duplicate) and `app/api/training-enrollments/[id]/route.ts` (`PATCH`,
  status update — supplier-only via `requireSupplier()`, ownership checked
  against the training session's `companyId`, `422` on an invalid/unreachable
  target status).

**Tests:** `lib/training-enrollments.test.ts` — enrolling creates a row with
status `enrolled`; enrolling the same user in the same session twice rejects
cleanly (unique constraint, not a raw DB exception surfacing); the same user
can enroll in two different sessions; `hasExistingEnrollment` returns
false→true correctly; status moves `enrolled`→`awaiting_signoff`→`completed`;
`cancelled` reachable directly; setting status back to `enrolled` rejects. All
pass in `npm test`.

**Verified live** (2026-07-19, this session) — `ethan@example.com` enrolled in
training session 25 "Fire Marshal Certification Workshop" (company 113) →
`201`, `status: enrolled`; direct query confirmed the row and a matching
`activity_log` row (`action_type: training_enrolled`). `ben@acmecoworking.sg`
(session 25's supplier) moved it `awaiting_signoff` → `completed`, both `200`;
attempting to set it back to `enrolled` → clean `422`. A second enroll attempt
by `ethan` on the same session → clean `409
{"message":"You are already enrolled in this training session."}`. Scratch
enrollment and activity_log row deleted afterward.

## Sprint 3.5, End-to-End Re-Verification (2026-07-19)

Per an explicit re-verification request: re-ran the full Sprint 3.5 checklist
end to end before moving to Sprint 4, rather than trusting prior sessions'
"Verified live" notes at face value. Found and fixed two gaps in the process:

1. **The sprint plan's checkboxes didn't match git history.** Known Gap #3
   (decline), Known Gap #4 (bulk order), and the `training_enrollments` item
   were all already committed and covered by passing tests, but the sprint
   plan still showed them unchecked and CLAUDE1.md had no session write-up for
   any of the three — backfilled above, checkboxes corrected in
   `SPRINT_PLAN_NEXTJS_REWRITE.md`.
2. **`npm test` isolation was configured but not re-confirmed since the setup
   commit.** Re-verified by snapshotting `spacesnap_dev`'s `transactions` and
   `bookings` row counts, running the full `npm test` (60 tests, real
   inserts/deletes against whatever `DATABASE_URL` resolves to), and
   confirming the dev DB counts were byte-identical after — the suite only
   ever touched `spacesnap_nextjs_test`.

**Live verification performed this session** (dev server + dev DB, real
cookie-jar logins, direct `psql` queries against `transactions` after each
action, all scratch rows deleted and balances confirmed restored afterward):
booking creation debit (re-confirmed, see Known Gap #1), booking confirm
audit row (re-confirmed, see Known Gap #2), booking decline refund (Known Gap
#3 above), bulk order purchase debit with correct `price_per_unit × quantity`
math (Known Gap #4 above), wallet top-up (re-confirmed, see Known Gap #5),
and training enrollment create/status-update/duplicate-rejection (new schema
item above). One booking (id 146) was round-tripped through create →
confirm → decline in a single sequence specifically to prove the three-row
Transaction chain (`-25.00` / `0.00` / `25.00`) nets to a restored balance,
not just that each action works in isolation.

**Housekeeping note:** an early cleanup query used
`WHERE description LIKE '%#146%' OR action_type IN (...) AND user_id = ... AND created_at > ...`
without parenthesizing the `OR` branch — Postgres's `AND`-binds-tighter-than-`OR`
left 3 scratch `activity_log` rows (`wallet_topup`, `bulk_order_created`,
`training_enrolled`) undeleted on the first pass. Caught by re-querying
`activity_log` for the test user afterward instead of trusting the `DELETE n`
row count, and cleaned up with an explicit `id IN (...)` on the second pass.
Worth remembering for any future manual test-data cleanup in this project:
always re-query after a multi-clause `DELETE`, don't just trust the reported
count matches intent.

**Sections 1–9 descope/stub audit:** nothing new found beyond what's already
flagged inline in `SPRINT_PLAN_NEXTJS_REWRITE.md` — the `is_verified`
admin-review flag (Sprint 2, deliberately not added, trigger/effect still
undefined), the Verifications tab (Sprint 1, same reason), sign-out still
unwired in both navbars (Sprint 1), the no-show/no-check-in grace-window
question (Sprint 3.5, still an open product decision), Sprint 1 pages still on
mock data pending Sprint 3's "connect real endpoints" item, React Query not
yet wired, and the Sprint 4 route-protection gap (no `middleware.ts` or
per-layout `auth()` guard — still open, blocking Sprint 4 completion, not a
Sprint 3.5 concern but confirmed still true by inspection this session). No
additional silent descopes surfaced by this pass.

## Sprint 4, Item 4 — Training/Credentialing Flow: Submit, Review, Pass/Fail, Issue Credential (2026-07-19)

Task brief asked to check how the old app handled quiz grading and
`training_enrollments` status before building, and explicitly not to invent
new statuses. Both checks were done before writing any code:

- **Quiz grading**: grepped `spacesnap-api` directly — `QuizQuestionController`
  only ever builds a quiz (supplier/admin authoring), and
  `TrainingVideoController::complete` just upserts a `VideoCompletion` row
  (watched, not graded). There is no submission/grading endpoint anywhere in
  the old backend, confirmed via `CODEBASEAPI_SUMMARY.md` §3/§6 and a direct
  grep. So "check old codebase before assuming manual review" surfaced the
  real answer: there's nothing to port for grading, because it was never
  built — this is genuinely new logic, not a port.
- **Which review model applies where**: `CertificateEarningMethod`'s own three
  labels (Sprint 4, Item 2 revised, see above) already answer this — `tier1_video_quiz`
  is explicitly self-serve, `tier2a_operator_signoff`/`tier2b_operator_or_sme_signoff`
  are explicitly sign-off-gated. So tier1 is auto-graded (no reviewer), tier2a/2b
  stays on the existing `training_enrollments` status flow (`enrolled` ->
  `awaiting_signoff` -> `completed`/`cancelled`, already built in Sprint 3.5) with
  a supplier as the reviewer. No single unified "review" mechanism was built
  across both paths — building one would have meant inventing a status/reviewer
  concept tier1 explicitly doesn't have.
- **`training_enrollments` status — confirmed no new values needed**: `completed`
  is the pass outcome, `cancelled` is the fail/no-credential outcome. `cancelled`
  already meant "this enrollment didn't produce a credential" before this item
  (voluntary withdrawal or a rejected sign-off) — reusing it for "failed
  sign-off" doesn't change its existing meaning, just gives it a second real
  trigger. No `failed` status was added, per the brief's explicit instruction.

**The missing link, found before building anything:** neither `TrainingVideo`
nor `TrainingSession` had any FK to the `Certificate` they actually grant —
confirmed by re-reading `prisma/schema.prisma` directly, not assumed.
`TrainingSession.endorsementName` (ported as-is from the old schema, "granted
on completion") looked at first like it might already carry this, and the
seed data's `endorsementName` values do match certificate names exactly
(`"Fire Safety Marshal"`, `"Equipment Handling - Forklift"`) — but per
`CODEBASEAPI_SUMMARY.md` §6, that field was never wired to real issuance
logic in the old app, and `Certificate.name` has no uniqueness constraint, so
resolving it by string match at issuance time would be fragile. Added a real
`certificateId` FK on both `TrainingVideo` and `TrainingSession` instead
(nullable — not every video/session grants a cert), migration
`20260719152218_add_quiz_attempts_and_credential_issuance`. `endorsementName`
is untouched, kept as display text.

**What was built:**
- Schema: `TrainingVideo.certificateId`, `TrainingSession.certificateId` (both
  nullable FKs to `Certificate`), new `QuizAttempt` model (`quiz_attempts`
  table: `userId`, `trainingVideoId`, `score`, `totalQuestions`, `passed`,
  `createdAt` only — append-only like `ActivityLog`, no unique constraint on
  `(userId, trainingVideoId)` so retakes after a fail create a new row rather
  than overwriting). Two new `ActivityActionType` values: `quiz_attempt_submitted`,
  `credential_issued`.
- `lib/training-credentials.ts` — `issueCredential(tx, {userId, certificateId,
  description})`, shared by both earning paths so the actual "create a
  `user_certificates` row" trigger exists in exactly one place. Confirmed
  before building that no such trigger existed anywhere yet (`CODEBASEAPI_SUMMARY.md`
  §6: "no confirmed trigger exists in the traced code... may be manual admin
  action, automatic on some condition, or genuinely unbuilt" — genuinely
  unbuilt, on both the old and new codebases). Upserts on the existing
  `@@unique([userId, certificateId])` constraint rather than always-creating,
  so re-earning an already-held (e.g. expired) certificate renews
  `earnedDate`/clears `expiryDate` instead of throwing — new mechanism, no old
  renewal behavior to diverge from (see the schema's own "renewal-by-video
  flow deferred, column ready" comment on `expiryDate`).
- `lib/quiz-attempts.ts` — `parseQuizSubmission`, `gradeAndSubmitQuizAttempt`.
  Grades a `{ answers: [{questionId, answerId}] }` submission against
  `QuizAnswer.isCorrect`, rejects (422) if the submission doesn't cover
  exactly the video's current question set (not silently marked wrong).
  Passing requires every question correct — this app has no partial-credit/
  percentage-threshold concept anywhere to base a lower bar on and the old
  app never built grading at all, so "all correct" is the simplest defensible
  default; flagging as revisitable if a percentage threshold is wanted later.
  On a pass, issues a credential via `lib/training-credentials.ts` only if the
  video has a `certificateId` set — a video's quiz can exist as a pure
  knowledge check with no auto-issuance (e.g. `forkliftVideo` in the seed has
  a quiz but its cert, `forkliftCert`, is `tier2a_operator_signoff`, not
  `tier1_video_quiz`, so it deliberately has no `certificateId` link).
- `lib/training-enrollments.ts`'s `updateEnrollmentStatus` now runs inside a
  `$transaction` and issues a credential when a status update is a genuine
  new transition into `completed` (guarded against the *previous* status also
  being `completed`, so re-PATCHing an already-completed enrollment can't
  re-fire issuance/logging) and the session has a `certificateId`.
- `app/api/training-videos/[id]/quiz-attempts/route.ts` — `POST` (submit +
  grade, any authenticated user, no supplier/reviewer gate since tier1 has no
  reviewer) and `GET` (the caller's own attempt history on that video, so a
  failed result's score stays visible after a page refresh — same "no GET to
  list a user's own X" gap-closing idiom as `GET /api/bookings`).
- `prisma/seed.ts`: `safetyVideo.certificateId` -> `safetyInduction` (the only
  `tier1_video_quiz` cert). The two sign-off sessions'
  `certificateId` set to match their existing `endorsementName` text: "Fire
  Marshal Certification Workshop" -> `fireMarshalCert`, "Forklift Practical
  Assessment" -> `forkliftCert`.

**Tests:** `lib/quiz-attempts.test.ts` (grading logic — all-correct pass +
credential issued, one-wrong fail + nothing issued, no-linked-certificate
passes but issues nothing, retake-after-fail creates a second row not an
update, resubmit-when-already-held renews via upsert not a duplicate,
incomplete submission rejected, no-quiz-configured rejected, video-not-found
rejected) and `lib/training-credentials.test.ts` (first issuance creates row +
activity log, re-issuance of an expired credential renews via upsert). Four
new cases added to `lib/training-enrollments.test.ts` (completing a
certificate-linked enrollment issues a credential, cancelling issues nothing,
completing a session with no certificate just completes, re-completing an
already-completed enrollment doesn't re-issue/re-log). Both new files
registered in `package.json`'s `test` script. All 88 tests pass (35 new, 0
regressions). `npx tsc --noEmit`, `npx eslint`, and `next build` all clean.

**Verified live**, not just unit-tested — real cookie-jar logins against the
dev server/DB (`ethan@example.com`, `farah@example.com`, `ben@acmecoworking.sg`
as the Fire Marshal session's supplier). Had to restart the dev server mid-session:
its in-memory Prisma client predated the migration/regenerate and threw
`Cannot read properties of undefined (reading 'create')` on `tx.quizAttempt`
until restarted — worth remembering for future schema-change sessions, a
`prisma migrate dev` + `generate` doesn't hot-reload into an already-running
`next dev` process's Prisma client.
- Tier1: `ethan` (already holds `Basic Safety Induction`, earned 2026-01-15)
  submitted one wrong answer on video 28's quiz -> `201`, `passed: false`,
  `credentialIssued: false`, no ledger/credential change. Same video, all
  four correct -> `201`, `passed: true`, `credentialIssued: true`; `GET
  /api/credentials` confirmed the existing credential's `earnedDate` renewed
  to `2026-07-19` (today), not duplicated. `GET .../quiz-attempts` showed both
  attempts, newest first.
- Tier2: `farah` enrolled in training session 28 ("Fire Marshal Certification
  Workshop", linked to `fireMarshalCert`) -> `201`. `ben` (that session's
  company's supplier) `PATCH .../training-enrollments/3 {"status":"completed"}`
  -> `200`; `GET /api/credentials` as `farah` confirmed a brand-new `Fire
  Safety Marshal` credential appeared, `earnedDate: 2026-07-19`. Separately,
  `ethan` enrolled in the same session, `ben` set that enrollment straight to
  `cancelled` -> `200`; `ethan`'s existing (already-expired) Fire Safety
  Marshal credential was confirmed unchanged (`earnedDate` still `2025-01-10`,
  not renewed) — cancelling correctly issues nothing.
- Unauthenticated `POST .../quiz-attempts` -> `401`. Incomplete submission
  (one of four questions answered) -> clean `422`.
- All scratch rows deleted afterward via a one-off script (both quiz attempts,
  both enrollments, farah's newly-issued credential row, the activity_log rows
  from this session) and `ethan`'s renewed `earnedDate` reverted to its seeded
  value — confirmed DB back to exactly the seeded state (`ethan`: cert 56
  earnedDate back to `2026-01-15`; `farah`: only her original 2 credentials
  remain; 0 `quiz_attempts`/`training_enrollments` rows in the DB).

**Not built, per the brief's scope:** no frontend wiring (the quiz-taking UI,
`ViewNamelistModal`'s pass/fail display, and `TrainingVideoModal`'s authoring
flow all stay on mock data per the standing "don't delete unbackended UI"
rule — this item was backend-only, matching the pattern of every other Sprint
3.5/4 schema item so far). No `GET /api/training-videos` or `GET
/api/training-sessions` listing endpoints — still-open, separately-tracked
gaps (`SPRINT_PLAN_NEXTJS_REWRITE.md` Sprint 3 Session 4 notes), out of this
item's scope to avoid expanding into a full training-video/session CRUD pass.
No prerequisite check that the video was actually watched
(`VideoCompletion`) before allowing a quiz submission — that endpoint
(`POST /training-videos/{id}/complete`) doesn't exist in this stack yet
either; flagging as a related-but-separate port gap, not silently assumed
away.

## Sprint 4, Item 4, Correction — tier2a Is Not `training_enrollments` (2026-07-19)

**The write-up above wrongly conflated tier2a and tier2b.** Both were routed
through `TrainingSession`/`TrainingEnrollment`, differing only in who signs
off. The product owner corrected this directly: tier2a_operator_signoff is
**not** a scheduled-session/enrollment concept at all. It's an on-demand,
per-user flow with two entry points — the user requests a live demo session
with the operator, or uploads a recorded demo for the operator to review
async. Reviewing a recording, the operator can pass it or ask for a live
demo instead (never fail it outright off a recording alone — confirmed
explicitly); a live demo (either path) gets a direct pass/fail. tier2b
(training requiring operator OR external SME sign-off) is genuinely the
scheduled-session concept and was correctly modeled the first time — the
Fire Marshal Certification Workshop / `TrainingEnrollment` linkage stands
unchanged.

**Concretely wrong and fixed:** `forkliftCert` (tier2a_operator_signoff) had
been linked via `TrainingSession.certificateId` to "Forklift Practical
Assessment," implying completing that scheduled session would issue the
cert. Reverted — that session now carries no `certificateId` and issues
nothing; `TrainingSession.certificateId` is tier2b-only going forward (the
field itself wasn't removed, since it's still correct for tier2b, just no
longer misused for tier2a).

**What was built instead**, matching the two-question clarification the
product owner answered before this was rebuilt (recording review can only
pass or escalate, never fail outright; one record per user+certificate, with
a real uploaded file kept as evidence, not a URL field):
- Two new enums: `SignoffSubmissionType` (`recording`/`live_demo_request`),
  `SignoffRequestStatus` (`pending`/`live_demo_requested`/`passed`/`failed`).
- New model `CertificateSignoffRequest` (migration
  `20260719172551_add_certificate_signoff_requests`): one row per
  `(userId, certificateId)` (`@@unique`), not append-only like `QuizAttempt`
  — a fresh submission after a terminal outcome resets the same row rather
  than creating a new one, per the product owner's explicit instruction.
  `recordingKey` is an R2 object key, not a URL — evidence is reviewed, not
  publicly displayed.
- **First real file-storage integration in this codebase.** Every other
  "file" in this app (training video/thumbnail, listing images) is a bare
  URL string the caller supplies directly — no actual upload/storage path
  exists anywhere yet (matches the old app's own unbuilt gap,
  `CODEBASEAPI_SUMMARY.md` §6). Per the stack decision
  (`AGENTS.md`/`CLAUDE1.md`: "File storage: Cloudflare R2"), added
  `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` and
  `lib/storage.ts`: presigned PUT (client uploads the video directly to R2 —
  this app's Route Handlers never proxy the file bytes), a `HeadObjectCommand`
  existence check before a submission is accepted (so a client can't claim a
  `recordingKey` it never actually uploaded to), and presigned, short-lived
  GET URLs for review (15 min — evidence is access-controlled, not a
  permanent public link like `training_videos.video_url`). New env vars
  `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`
  added to `.env.example`; **no real R2 credentials exist in this dev
  environment**, so the actual upload/storage calls are wired per the stack
  decision but not live-tested against real R2 — same category of gap as
  this app's Stripe integration (wired, test-mode/unconfigured, never
  live-verified). Confirmed live that the code path is reached and fails
  with a clean, specific "R2 storage is not configured" error (not a crash
  or a silent no-op) when credentials are absent.
- `lib/certificate-signoffs.ts` — `submitSignoffRequest` (validates the
  certificate's `earningMethod` is actually `tier2a_operator_signoff`,
  upserts the one-row-per-pair record, rejects a second submission while one
  is already in flight) and `reviewSignoffRequest`, which enforces the exact
  transition table confirmed with the product owner: `pending`+`recording`
  → `passed` or `live_demo_requested` only (never `failed` directly);
  `pending`+`live_demo_request` → `passed` or `failed` (never
  `live_demo_requested` — it's already a live demo); `live_demo_requested` →
  `passed` or `failed`. Deliberately takes `recordingKey` as a plain string
  rather than depending on `lib/storage.ts` directly, so this module stays
  DB-only and unit-testable without real R2 credentials, same as every other
  `lib/*.ts` file in this app. On `pass`, issues a credential via the same
  `lib/training-credentials.ts` helper tier1/tier2b use.
- Routes: `POST /api/certificates/[id]/signoff-requests/upload-url`
  (presigned PUT), `POST`/`GET /api/certificates/[id]/signoff-requests`
  (submit/view own), `GET /api/supplier/certificate-signoff-requests` +
  `GET /api/admin/certificate-signoff-requests` (reviewer queues), `PATCH
  /api/certificate-signoff-requests/[id]` (review decision).
- **Review authority — a judgment call, not specified by the product owner,
  flagging explicitly:** `Certificate.createdByCompanyId` has no company for
  platform-authored certs (`forkliftCert` included — `source: platform`,
  confirmed via the seed), so there's no supplier to scope a review queue to.
  Resolved as: a supplier at `createdByCompanyId` reviews when it's set,
  system admin reviews when it's null. This mirrors how ownership scoping
  works everywhere else in this app (`requireSupplier()`/company-match), but
  wasn't explicitly confirmed with the product owner the way the two
  clarifying questions above were — worth a second look if it turns out
  wrong, same as the admin-scope judgment calls flagged in Sprint 3 Session 4.

**Tests:** new `lib/certificate-signoffs.test.ts`, 19 cases covering the full
transition table (every allowed and disallowed decision at every status ×
submissionType combination), the in-progress-conflict rejection, the
reset-not-duplicate resubmission behavior, wrong-earning-method rejection,
and credential issuance on pass. Registered in `package.json`'s `test`
script. All 107 tests in `npm test` pass (19 new, 0 regressions). `npx tsc
--noEmit`, `npx eslint`, and `next build` all clean.

**Verified live**, not just unit-tested, for everything not gated on real R2
credentials — real cookie-jar logins (`ethan@example.com`,
`alice.admin@spacesnap.sg` the system admin, `ben@acmecoworking.sg` a
supplier at a company that doesn't own `forkliftCert`) against the dev
server/DB:
- Wrong earning method (cert 61, tier1) → clean `422`. Unauthenticated
  submit → `401`.
- `ethan` submits `live_demo_request` for `forkliftCert` (62) → `201`,
  `pending`. Resubmitting while pending → `409`.
- `ben` (Acme supplier, doesn't own this cert) → `PATCH` review → `403`;
  his supplier queue correctly returns empty (Acme created 0 tier2a certs).
- `alice` (system admin) → her admin queue correctly lists the pending
  request; attempting `request_live_demo` on it → clean `422` ("already a
  live demo"); `fail` → `200`, `ethan`'s credentials confirmed unchanged
  (no forklift cert).
- `ethan` resubmits (same request row, id unchanged) with a `recording`
  submission and a `recordingKey` that was never actually uploaded → clean
  `422 {"recordingKey":["No uploaded recording was found for this key."]}` —
  confirms the R2 existence-check gate correctly rejects a fabricated key
  even without real credentials configured (the "not configured" case and
  the "genuinely doesn't exist" case both currently return `false` from
  `evidenceRecordingExists`'s catch-all — noted below as a known
  debuggability gap, not a correctness bug: either way the submission is
  correctly rejected).
- `ethan` resubmits again with `live_demo_request` → same row (id `1`)
  reset to `pending`, not a new row. `alice` passes it → `200`; `ethan`'s
  `GET /api/credentials` confirmed a brand-new `Equipment Handling -
  Forklift` credential appeared, `earnedDate` today.
- Re-reviewing the now-`passed` request → clean `422` (terminal, no further
  transitions).
- `POST .../upload-url` with no real R2 credentials configured → clean `500`
  with the exact `"R2 storage is not configured..."` message (confirmed via
  server logs), not a generic crash — the code path works, it's specifically
  missing external credentials, matching the flagged gap above.
- All scratch rows deleted afterward (`certificate_signoff_requests`,
  `ethan`'s newly-issued forklift `user_certificates` row, the
  `signoff_requested`/`signoff_reviewed` activity_log rows); DB confirmed
  back to exactly the seeded state.

**Known gaps, flagged not silently dropped:**
- `evidenceRecordingExists` returns `false` both when R2 is unconfigured and
  when a key genuinely doesn't exist — fine for correctness (both cases
  correctly reject the submission) but not ideal for debugging a real
  misconfigured-credentials incident in production, where the error message
  would misleadingly say "no recording found" instead of "storage
  misconfigured." Worth distinguishing if this becomes a real support
  burden.
- No real R2 credentials exist in this dev environment, so the actual
  presigned-upload → R2 → HeadObject round trip has never been exercised
  against real storage, only against the "not configured" error path.
  Needs a real Cloudflare R2 bucket + API token before this can be
  considered fully live-verified — same posture as this app's Stripe
  integration.
- Review-authority scoping (supplier-at-createdByCompanyId, else
  system-admin) is a judgment call, not confirmed with the product owner the
  way the transition-table/data-model questions were.
- No frontend wiring for any of this (submission form, video-upload UI,
  reviewer queue/decision UI) — backend-only, consistent with the rest of
  this item.

## Sprint 4, Route Protection — `proxy.ts` (2026-07-20)

Closed the last open Sprint 4 item: no server-side route protection existed
anywhere (see "Sprint 3, Session 2" above). Before writing anything, checked
`node_modules/next/dist/docs` per `AGENTS.md`'s "this is not the Next.js you
know, read the docs first" rule — good thing this was checked: **this
Next.js version (16.2.10) renamed the `middleware.ts` file convention to
`proxy.ts`** (`export function proxy` or default export, not `middleware`).
Writing a `middleware.ts` file here would have silently done nothing — no
error, no warning, just never invoked. `node_modules/next/dist/docs/01-app/
03-api-reference/03-file-conventions/proxy.md` confirms Proxy still defaults
to the Node.js runtime (not Edge), so `auth()`'s Prisma-backed `jwt` callback
(the per-read suspension check from Sprint 3 Session 2) works the same as it
does in a Server Component or Route Handler — no Edge-runtime compatibility
issue to work around.

**What was built:** `proxy.ts` at the repo root, wrapping `auth()` (the
Auth.js v5 `NextAuthMiddleware` overload, confirmed via
`node_modules/next-auth/lib/index.d.ts`) rather than reading the JWT cookie
manually. Three path-prefix arrays (`USER_ROUTES`, `SUPPLIER_ROUTES`,
`ADMIN_ROUTES`) mirror the three route groups' actual page directories
(`app/(user)/{user,marketplace,passport,wallet}`, `app/(supplier)/supplier*`,
`app/(admin)/admin*`) — matched directly against `req.nextUrl.pathname`
rather than trying to infer the route group from the URL, since route groups
themselves don't appear in the URL. Unauthenticated request to any matched
path → redirect to `/login`. Authenticated but wrong role → redirect to
`getRoleHome(session.user)` (reused as-is from `lib/role-home.ts`, the same
helper `RoleGuard`/`components/RoleGuard.tsx` already used client-side — no
new "what's this role's home page" logic invented). Right role → `next()`.
`config.matcher` lists the same path prefixes explicitly (not a catch-all
negative matcher) so `/login`, `/signup`, `/`, and all `/api/*` routes are
untouched — API routes already do their own `auth()`/`requireSupplier()`/
`requireSystemAdmin()` checks per-route (Sprint 3 Sessions 3/4), this closes
the page-rendering gap specifically, not a defense-in-depth pass over API
routes that didn't need one.

**Verified live**, not just typechecked — `npx tsc --noEmit` and `npx eslint
proxy.ts` both clean, then real HTTP checks against the dev server:
- No session cookie → `curl -I` on every one of `/admin`, `/supplier`,
  `/user`, `/marketplace`, `/wallet`, `/passport`, `/supplier-inventory`,
  `/admin-users` → `307` to `/login`; `/login`, `/signup`, `/` unaffected
  (`200`, no redirect).
- Real cookie-jar login as `ben@acmecoworking.sg` (supplier, not system
  admin) via `/api/auth/callback/credentials` → `GET /admin` → `307` to
  `/supplier` (his own role home, not a blank/error page) — matches
  `RoleGuard`'s existing client-side behavior, now backed by an actual trust
  boundary. `GET /supplier` (his own route) → `200`. `GET /marketplace` (the
  generic user-group route, no role restriction beyond "authenticated") →
  `200`. `GET /admin-users` → `307` to `/supplier` again, confirming the
  redirect isn't just a one-off on the bare `/admin` path.

**Not touched:** API route auth (already covered per-route), the client-side
`RoleGuard` (left as-is — it still stops role-gated UI from flashing before
a redirect completes, now genuinely a UX nicety rather than the only line of
defense).

## Marketplace, Bulk Purchase Option for In-Stock Consumables (2026-07-20)

Product owner request, not a mock-data/backend gap: give in-stock consumable
listings on the marketplace a bulk-purchase option alongside "Buy Now."

**What was actually already true, checked before building:** every consumable
listing — in stock or not — already funneled into the same
`RequestPurchaseModal` (quantity stepper, `POST /api/bulk-order-requests`,
pending-approval-by-supplier semantics per Sprint 3.5 Known Gap #4). The only
difference between an in-stock and out-of-stock consumable was the button's
label text ("Buy Now" vs. "Request Purchase"); the underlying flow — and the
ability to set quantity > 1 — was already identical either way. So the ask
wasn't "add bulk-purchase capability" (it existed), it was "make it
discoverable for in-stock items without requiring the user to notice a
quantity stepper hidden inside what looks like a single-item 'Buy Now'
button."

**What was built:** `components/RequestPurchaseModal.tsx` gained a `mode:
"quick" | "bulk"` prop (default `"bulk"`, preserving existing callers'
behavior). `"quick"` locks quantity at 1, hides the stepper, shows a plain
"1 unit" line instead, and labels the action "Confirm Purchase"; `"bulk"` is
the pre-existing quantity-picker UI, unchanged. Both modes still call the
same `useCreateBulkOrder()` mutation — no new endpoint, no new debit path,
since creating a real second "instant, no-approval" purchase mechanism was
never asked for and would have meant inventing a bypass around the existing
pending-approval design.

`app/(user)/marketplace/page.tsx`: factored the single "Book Now / Buy Now /
Request Purchase / Cert Required" button (previously duplicated once in the
grid card body and once in the map view's side panel) into one
`ListingActions` component used by both. For an in-stock consumable
(not cert-missing, not unavailable, not out-of-stock) it now renders two
stacked buttons — "Buy Now" (`onRequestPurchase(listing, "quick")`) and
"Request Bulk Purchase" (`onRequestPurchase(listing, "bulk")`) — instead of
one. Out-of-stock consumables, non-consumables, cert-missing, and
unavailable states are all unchanged (still a single button each). Parent
page tracks a `requestMode` state alongside the existing `requestListing`
state, set by a new `handleRequestPurchase(listing, mode)` passed down to
both the grid and map views.

**Verified live**, not just typechecked (`npx tsc --noEmit` / `npx eslint`
both clean) — real cookie-jar login as `ethan@example.com` against the dev
server/DB, listing 166 "Compostable Packaging Boxes" (in stock, 18.5 cr/unit):
"Buy Now" → modal opens with quantity locked at "1 unit", "18.5 credits",
button reads "Confirm Purchase" → submit → "Order Submitted... 18.5 credits
have been reserved." Separately, "Request Bulk Purchase" → quantity stepper
starts at 1, incremented to 3 → "55.5 credits" (18.5 × 3, confirmed exact) →
"Submit Order" → "Order Submitted... 55.5 credits have been reserved."
Direct query on `bulk_order_requests`/`transactions` confirmed exactly the
two expected rows (`quantity: 1, credits: 18.50` and `quantity: 3, credits:
55.50`, both `type: purchase`); `ethan`'s ledger balance read `6.00`
(`80 - 18.5 - 55.5`) before cleanup. Both scratch rows and their transactions
deleted afterward; balance re-confirmed back to `80.00`, zero leftover
`bulk_order_requests` rows for the test user.

**Not touched:** out-of-stock consumables' single "Request Purchase" button
(unaffected — it already exposed the full quantity picker), and no new
"instant, bypasses supplier approval" purchase mechanism was built — both
buttons still create a `pending`-status `BulkOrderRequest`, per the existing
design.

## Marketplace, Bulk Purchase Option — Correction: "Buy Now" Is Not a BulkOrderRequest (2026-07-19)

**The write-up above was wrong about what "Buy Now" should do.** It reused
`BulkOrderRequest`/`POST /api/bulk-order-requests` for both buttons, on the
reasoning that the quantity-request flow already existed and "Buy Now" just
needed to be discoverable. The product owner corrected this directly: Buy Now
must **deduct stock and credits** as an immediate, completed sale — it is not
a request for the supplier to act on. For context only (not built here, ignore
for now): the eventual Stripe integration should give the user an invoice and
the supplier a receipt of funds for a Buy Now purchase — Sprint 6 scope,
`Transaction.stripePaymentIntentId` already exists in the schema for exactly
this, nothing added or changed on that front this session.

**What changed, concretely:**
- New model `Purchase` (migration `20260719190805_add_instant_purchases`):
  `userId`, `listingId`, `quantity`, `credits`, `createdAt` only — deliberately
  no `status` column, unlike `BulkOrderRequest` (`pending`/`confirmed`/
  `fulfilled`/`cancelled`). A Purchase row is created only once it's already
  complete; there's nothing left to transition. `Transaction` gained a
  nullable `purchaseId` FK alongside the existing `bookingId`/
  `bulkOrderRequestId`, and `ActivityActionType` gained
  `instant_purchase_completed` (one enum value per event, per this app's
  existing activity-log taxonomy convention — not reusing `bulk_order_created`
  for a materially different event).
- `lib/purchases.ts` — `createPurchaseWithDebit(params)`, same
  "check-then-write inside one `$transaction`" shape as
  `createBulkOrderWithDebit`/`createBookingWithDebit`, but with a second guard
  bulk orders never needed: stock. The stock decrement uses
  `tx.listing.updateMany({ where: { id, stockQuantity: { gte: quantity } },
  data: { stockQuantity: { decrement: quantity } } })` rather than a
  read-then-write — Postgres takes a row lock on the `UPDATE`, so a concurrent
  purchase against the same near-empty stock re-evaluates the `gte` guard
  against the post-commit value instead of a stale read, closing the
  overselling race that the credit-balance check right after it still has
  (that credit-balance race is the same pre-existing, explicitly accepted gap
  as Sprint 3.5 Known Gap #1 — not reopened or fixed here, just not worth
  re-solving for stock too since the `updateMany` guard was cheap to add
  correctly from the start). Throws `InsufficientStockError` (mirroring
  `InsufficientCreditBalanceError`'s shape, `lib/credits.ts`) if the guarded
  update affects zero rows.
- `app/api/purchases/route.ts` — `POST`, same consumables-only /
  price-must-be-set validation as `POST /api/bulk-order-requests`
  (`app/api/bulk-order-requests/route.ts`), catches both
  `InsufficientCreditBalanceError` and `InsufficientStockError` into the same
  clean `422` shape.
- `lib/hooks/useListings.ts` — new `useCreatePurchase()` hook, `POST
  /api/purchases`, separate from `useCreateBulkOrder()` (different endpoint,
  not a flag on one mutation).
- `components/RequestPurchaseModal.tsx` — picks `useCreatePurchase()` vs
  `useCreateBulkOrder()` based on the existing `mode` prop (`"quick"` vs
  `"bulk"`, unchanged from the prior session) rather than always hitting bulk
  orders. Success copy now actually matches what happened: quick mode shows
  "Purchase Complete... N credits were charged" instead of the bulk-mode
  "pending approval... credits have been reserved" text, which was accurate
  for a request but wrong for a completed sale.

**Tests:** new `lib/purchases.test.ts` (added to `npm test`), 4 cases —
insufficient stock rejected with nothing written and stock unchanged,
insufficient credit balance rejected *and* the stock decrement rolled back
with it (not just the credit side), a normal purchase decrementing stock and
debiting credits exactly with one `Purchase` row and zero `BulkOrderRequest`
rows, and an exact-stock-boundary purchase (quantity == remaining stock)
succeeding and leaving stock at exactly zero. All 111 tests in `npm test`
pass (4 new, 0 regressions). `npx tsc --noEmit`, `npx eslint`, and `next
build` all clean. Dev server restarted after the migration + `prisma
generate` (same "Prisma client doesn't hot-reload into an already-running
`next dev` process" gotcha noted in Sprint 4 Item 4's write-up).

**Verified live**, not just unit-tested — real cookie-jar login as
`ethan@example.com` against the dev server/DB, listing 166 "Compostable
Packaging Boxes" (stock 400, 18.50 cr/unit, seeded balance 80): clicked "Buy
Now" in the actual browser UI → modal correctly showed "Confirm your
purchase" / "1 unit" / "18.5 credits" / "Confirm Purchase" (no stepper) →
submit → "Purchase Complete. You bought 1 unit... 18.5 credits were charged."
Direct query confirmed exactly one `purchases` row (`quantity: 1, credits:
18.50`), listing 166's `stock_quantity` at `399`, exactly one `transactions`
row (`type: purchase`, `purchase_id` set, `amount: -18.50`), zero new
`bulk_order_requests` rows, and balance at `61.50` (`80 - 18.50`). Separately,
via `curl`: quantity `100000` against the same listing → clean `422
{"errors":{"quantity":["Insufficient stock for this purchase."]}}`; a
non-consumable listing (162, "Studio Space A") → clean `422` "Buy Now is only
available for consumable listings."; unauthenticated → `401`; "Request Bulk
Purchase" on the same listing (quantity 2) → still `201` on `POST
/api/bulk-order-requests` with a real `bulkOrderRequest` response and a
`type: purchase` Transaction tied to `bulk_order_request_id` (not
`purchase_id`) — confirming the two paths stayed genuinely separate, not
just cosmetically. All scratch rows (`purchases`, `bulk_order_requests`,
`transactions`, `activity_log`) deleted afterward; `ethan`'s balance
re-confirmed back to `80`, listing 166's stock back to `400`.

**Not touched:** out-of-stock consumables' single "Request Purchase" button
(still the bulk-order-request flow, unaffected), and no Stripe code of any
kind — the product owner was explicit this is for-context-only future scope.

---

## Sprint 4.5 — Check-Ins UI Deferred, Not Built (2026-07-20)

Before starting the check-ins UI item, read two files the product owner
provided for context on the physical kiosk system: `Handshake_17 May
2026.pdf` (the kiosk-to-cloud handshake diagram — user scans → cloud does
auth/passport/credential match → proprietary middleware (the Pi) does the
API bridge + liability bind → hardware dispenses the RFID/NFC card *and*
writes the `CheckIn` in the same step) and `SpaceSnap_Trust_Architecture_
Levels_1-5.docx` (ranks candidate trust architectures for the access-decision
split; Level 2, "facts in, Pi decides locally," is the actual POC build
target — Next.js supplies raw facts only, the Pi evaluates the match locally
and fires the dispenser itself, then writes the CheckIn with an idempotency
key; Level 1, "Next.js sends a yes/no verdict," is explicitly rejected as
forgeable and as contradicting the submitted grant claim that the cloud
platform doesn't make the access decision).

**Conclusion (confirmed with product owner): this item can't be built as a
web UI at all right now, and isn't just a UI gap to close.** A browser
"Check In" button would fabricate a credential-verification event that's
only ever supposed to happen at the physical kiosk — there's no card, no
physical-presence check, and no Pi in a browser session, so Next.js has no
legitimate basis to write a `CheckIn` row on a user's say-so. Same logic
kills a browser "Check Out" button (presumably the card being tapped back at
the kiosk, not a click). This is blocked on Sprint 5 (kiosk/middleware), not
something to stand in for with a web mockup — marking it deferred in
`SPRINT_PLAN_NEXTJS_REWRITE.md` with this reasoning rather than building
anything.

---

## Sprint 4.5 — Bulk Order Requests: Supplier UI + Backend (2026-07-20)

Built the supplier-facing bulk order request management the sprint plan's
`supplier-requests` page had a stub for ("Not wired yet — there's no
supplier-facing GET endpoint... no confirm/decline/fulfill routes").

**Correction made before writing any of this, per the product owner:**
credits are **not** debited at bulk-order-request creation. An earlier
session (Sprint 3.5 Known Gap #4) had built `createBulkOrderWithDebit` to
debit at creation — explicitly reasoned at the time as "unlike the old build,
this rewrite debits at request creation." That reasoning was wrong. Checked
the actual old Laravel controllers
(`spacesnap-api/app/Http/Controllers/BulkOrderRequestController.php` and
`SupplierBulkOrderController.php`): `store()` does no balance check and no
debit at all — just inserts the row; `update()`'s `fulfilled` branch is the
*only* place that checks balance and creates a debit `Transaction`. Reverted
`lib/bulk-orders.ts` to match: `createBulkOrder` (renamed from
`createBulkOrderWithDebit`) now just inserts the row and logs
`bulk_order_created`, no balance check, no `Transaction`. Rewrote
`lib/bulk-orders.test.ts` to match (was asserting the old, wrong behavior).
Updated the stale comments in `lib/credits.ts` and `lib/wallet.ts` that
pointed at `createBulkOrderWithDebit` as a call site.

**What was built:**
- `lib/bulk-orders.ts` — three new status-transition functions, mirroring
  `confirmBookingWithAudit`/`declineBookingWithRefund` (`lib/bookings.ts`)
  in shape but not in ledger behavior, since (unlike a booking) nothing has
  been debited yet at confirm/decline time for a bulk order:
  - `confirmBulkOrder` — `pending→confirmed`, activity log only, no
    Transaction (nothing to audit yet).
  - `declineBulkOrder` — `pending/confirmed→cancelled`, activity log only,
    no refund Transaction (nothing was ever debited).
  - `fulfillBulkOrderWithDebit` — `pending/confirmed→fulfilled`, this is
    where credits actually move: `assertSufficientBalance` against the
    request's stored `credits` snapshot, one debit `Transaction`
    (`type: purchase`, matching what `createPurchaseWithDebit`/"Buy Now"
    already uses for the same kind of event), activity log. Mirrors old
    `SupplierBulkOrderController::update`'s `fulfilled` branch.
  - Three new `BulkOrderNot*Error` classes, same pattern as
    `BookingNotConfirmableError`/`BookingNotDeclinableError`.
- `ActivityActionType` gained `bulk_order_confirmed`, `bulk_order_declined`,
  `bulk_order_fulfilled` (migration
  `20260720032828_activity_action_type_add_bulk_order_transitions`, same
  `ALTER TYPE ... ADD VALUE` pattern as the earlier `training_enrolled`
  addition). Applied to both the dev DB and the isolated test DB
  (`npm run test:db:migrate`) — the two are separate Postgres databases and
  each needs migrations applied independently.
- `serializeBulkOrderRequest` extended to optionally include `listingName`/
  `userName`/`userEmail` when the caller included those relations (mirrors
  `serializeBooking`'s conditional-spread pattern) — needed for the
  supplier list view, matching old `SupplierBulkOrderController::transform`'s
  shape.
- New routes: `GET /api/supplier/bulk-order-requests` (company-scoped via
  the listing's `companyId`, optional `status` filter, same shape as
  `GET /api/supplier/bookings`), `PATCH .../[id]/confirm`,
  `.../[id]/decline`, `.../[id]/fulfill` — each does the same
  `requireSupplier()` + listing-company-ownership check as the existing
  booking confirm/decline routes.
- `lib/hooks/useSupplierBulkOrders.ts` — new React Query hook, mirrors
  `useSupplierBookings.ts` exactly (list query + three mutations, shared
  `["supplier-bulk-orders"]` invalidation).
- `app/(supplier)/supplier-requests/page.tsx` — replaced the placeholder
  "Bulk Orders" tab card with a real filtered list (`BulkOrderRow`,
  mirroring `BookingRow`) showing Confirm/Fulfill/Decline actions by status,
  reusing `DeclineReasonModal` (a second instance, separate state, same as
  the existing booking-decline modal).
- `components/RequestPurchaseModal.tsx` — fixed now-inaccurate copy: "X
  credits have been reserved" (implied a hold that no longer happens) →
  "X credits will be charged once the supplier fulfills it."

**Tests:** rewrote `lib/bulk-orders.test.ts` for the corrected design — 15
cases across `createBulkOrder` (no balance check, no Transaction, even at
zero balance), `confirmBulkOrder`, `declineBulkOrder` (no refund), and
`fulfillBulkOrderWithDebit` (insufficient balance rejected cleanly and
writes nothing, exact-balance success, confirmed-then-fulfilled, double-
fulfill rejected, fulfilling a cancelled request rejected). All 120 tests in
`npm test` pass. `npx tsc --noEmit`, `npx eslint`, and `next build` all
clean.

**Verified live** against the dev server/DB (not just unit tests) — real
cookie-jar sessions for both `ethan@example.com` (buyer, seeded balance 80)
and `gabriel@greenpack.sg` (GreenPack's supplier admin): submitted a
"Request Bulk Purchase" for 4 units of listing 166 (74 cr) as Ethan through
the actual browser UI → balance confirmed still `80` immediately after
(no debit at creation, as intended) → as Gabriel, the request showed up on
`/supplier-requests`'s Bulk Orders tab with the real requester name/email/
listing/quantity/cost → clicked Confirm → status flipped to `confirmed` →
clicked Fulfill → status flipped to `fulfilled`, and Ethan's balance dropped
to exactly `6` (`80 - 74`), confirming the debit happens only at fulfillment.
Separately tested the rejection path: created a second request (1 unit,
18.5 cr) against Ethan's now-6-credit balance, clicked Fulfill directly
(skipping confirm) → clean `422` "Requester has insufficient credit balance
to fulfill this order." rendered in the UI, request correctly stayed
`pending`, no partial state. Then tested Decline on that same request → the
existing `DeclineReasonModal` opened correctly, submit flipped status to
`cancelled`, no refund Transaction (correct, since nothing was ever debited).

One dev-environment gotcha hit again (same one Sprint 4 Item 4 and the
"Bulk Purchase Option" session both already noted): the running `next dev`
process had the pre-migration Prisma client loaded in memory, so the first
live Confirm attempt threw `PrismaClientValidationError: Invalid value for
argument actionType` even though `npx prisma generate` had already run —
restarting the dev server (not just regenerating the client) picked up the
new enum values. Worth remembering as a standing gotcha: an enum-adding
migration always needs a dev-server restart, not just `prisma generate`, if
the server was already running when the migration landed.

All scratch rows from live verification (`bulk_order_requests` 8 and 9, the
one `transactions` row from the fulfillment debit, and the five
`activity_log` rows the flow generated) deleted afterward via a one-off
script; `ethan`'s balance re-confirmed back to `80`, zero bulk order
requests remaining for that user.

**Not touched:** the "Certificate Requests" tab and the "Bookings" tab
(already wired, out of scope here); no changes to the user-side
`POST /api/bulk-order-requests` validation shape beyond removing the debit
call.

---

## Sprint 4.5 — Bulk Order Cancellation Flow + Delivery Estimate (2026-07-20)

Same-day follow-up to the bulk-order supplier UI/backend session above,
product owner requests: (1) the Fulfill button was clickable before Confirm
had ever been clicked — fixed to grey-out/disable until `confirmed`; (2)
asked whether credit holds on confirmation were feasible — answered
(new architecture, not built now, deferred as its own sprint-plan item, see
SPRINT_PLAN_NEXTJS_REWRITE.md Sprint 4.5); (3) buyers had no way to cancel a
bulk order at all — built; (4) suppliers should give an estimated delivery
week on confirm — built.

**Fulfill-button fix, first attempt failed silently:** the first pass styled
the disabled state by appending grey Tailwind classes to the existing
`className` string, but `Button`'s `primary` variant's teal gradient classes
were still present ahead of them via `variants[variant]`, and Tailwind
resolves conflicting same-specificity utilities by CSS declaration order in
the stylesheet, not by string position — the button kept rendering teal.
Confirmed via `getComputedStyle(...).backgroundImage` in the live browser
before assuming the visual fix had landed. Fixed by switching to `Button`'s
existing `variant="ghost"` prop for the disabled state instead of fighting
the gradient with more classes — `pending` → grey/disabled (`title="Confirm
the request before fulfilling it."`), `confirmed` → purple gradient/enabled.

**Design decisions, both confirmed with the product owner before building:**
- **Credit hold — deferred, not built.** Approved in principle ("add it to
  the sprint plan under 4.5"), explicitly not started. Real scope: balance
  today is always a live `SUM` of `Transaction` rows, no "reserved" concept
  anywhere; adding one means `assertSufficientBalance` and every balance
  check needs to account for held amounts, plus release-on-decline/cancel
  logic and a stale-hold policy. Not guessed at here.
- **Cancellation, two different paths depending on status** (buyer's own
  words): "If the supplier has not confirmed the order, the user can
  immediately cancel the order and its just closed. But if the supplier has
  confirmed the order, then the user will have to send a request to the
  supplier and the supplier will then have to review... an exclamation mark
  on the bulk order request on the request overview page... a modal that the
  user requested for cancellation (reasons included), and supplier CTA."
  Built exactly that.
- **Delivery estimate — required on Confirm**, not optional/deferred.

**Schema (migration `20260719200725_bulk_order_delivery_estimate_and_cancellation`,
generated via `prisma migrate dev --create-only` rather than hand-written, to
avoid subtly-wrong raw SQL):** `BulkOrderRequest` gained
`estimatedDeliveryDate` (nullable — pre-existing rows predate it; required by
app-layer validation on every confirm going forward) and
`cancellationRequestedAt`/`cancellationReason` (set together, cleared
together). `ActivityActionType` gained `bulk_order_cancelled` (buyer cancels
a still-pending request directly), `bulk_order_cancellation_requested`,
`bulk_order_cancellation_approved`, `bulk_order_cancellation_rejected` — one
value per event, same taxonomy convention as every other activity-log
addition this project has made. Applied to both dev and test DBs.

**`lib/bulk-orders.ts` additions:**
- `confirmBulkOrder(id, estimatedDeliveryDate)` — signature changed, now
  requires and stores the date; `parseEstimatedDeliveryDate` validates
  `YYYY-MM-DD` at the route layer.
- `cancelBulkOrderByUser(id, userId)` — buyer-initiated, immediate, only
  while `pending`. No refund logic (mirrors `declineBulkOrder`): nothing was
  ever debited pre-fulfillment.
- `requestBulkOrderCancellation(id, userId, reason)` — buyer-initiated, only
  while `confirmed`, rejects a second request while one's already pending
  review.
- `approveBulkOrderCancellation(id)` / `rejectBulkOrderCancellation(id)` —
  supplier-initiated; approve moves to `cancelled` and clears both fields,
  reject just clears both fields and leaves it `confirmed`.
- New `BulkOrderNotOwnedError` — deliberately covers both "doesn't exist" and
  "belongs to someone else" in one branch, mirroring `BookingNotOwnedError`
  (`lib/ratings.ts`) exactly, so a route can map it straight to a 404 without
  leaking whether the id exists for another user.
- `serializeBulkOrderRequest` extended with the three new fields (always
  present, not conditional — they're plain columns, unlike the
  relation-dependent `listingName`/`userName`).

**Routes:** `GET /api/bulk-order-requests` (buyer's own list, new — didn't
exist before this session, same shape as `GET /api/bookings`), `PATCH
/api/bulk-order-requests/[id]/cancel`, `POST
/api/bulk-order-requests/[id]/request-cancellation`, `PATCH
/api/supplier/bulk-order-requests/[id]/{approve,reject}-cancellation`.
`PATCH .../confirm` now requires `estimatedDeliveryDate` in the body.

**New components:** `ConfirmBulkOrderModal` (date input, gates the Confirm
action), `CancellationReviewModal` (supplier-side: shows the buyer's reason,
Approve/Reject CTAs), `RequestCancellationModal` (buyer-side: reason
textarea, mirrors `DeclineReasonModal`). New `lib/hooks/useMyBulkOrders.ts`
(buyer list + cancel + request-cancellation mutations) — first buyer-facing
bulk-order hook; extended `useSupplierBulkOrders.ts` with the two
cancellation-review mutations and changed `useConfirmBulkOrder`'s mutate
signature from `id` to `{id, estimatedDeliveryDate}`.

**User dashboard (`app/(user)/user/page.tsx`) gained a "Bulk Orders" card** —
didn't exist before this session; per an earlier Explore-agent check there
was no buyer-facing bulk-order list anywhere in the app, only the supplier
side. Shows status, estimated delivery once set, and the appropriate action
per status (`pending` → inline Cancel button, `confirmed` with no open
request → Request Cancellation button, `confirmed` with one pending →
"Cancellation requested" text, no button).

**Real bug found and fixed, not just in new code — a JSX whitespace gotcha:**
all three new modals (plus the pre-existing `DeclineReasonModal`, copied as
the template) wrote text like:
```jsx
Let <span>{name}</span> know why this request is being
declined.
```
Visually this rendered as "**GreenPack**know why..." — no space after the
name. Cause: when a JSX text node spans multiple source lines, Babel trims
*each line's* leading/trailing whitespace independently before joining with
single spaces, so the space that's visually "attached to the closing tag" on
the first line gets stripped along with normal line-start indentation, same
as any other line. This only manifests when text continues on a new source
line immediately after an inline element — a single-line adjacent tag+text
(`<b>x</b> y`) is unaffected. Confirmed via `element.innerHTML` in the live
browser (`get_page_text`/screenshots alone made it easy to misread as a font-
rendering illusion). Fixed all four components by inserting an explicit
`{" "}` after the closing tag rather than relying on line-wrap collapsing.
`DeclineReasonModal` is used by both the existing booking-decline and
bulk-order-decline flows, so this fixes a real, already-shipped user-facing
bug, not just the new modals.

**Tests:** `lib/bulk-orders.test.ts` — added `estimatedDeliveryDate` to every
`confirmBulkOrder` call (signature change) plus new coverage for
`cancelBulkOrderByUser` (success, wrong-owner rejected, confirmed-order
rejected), `requestBulkOrderCancellation` (success with reason stored,
pending-order rejected, duplicate-request rejected, wrong-owner rejected),
and `approveBulkOrderCancellation`/`rejectBulkOrderCancellation` (both happy
paths, both "no pending request" rejections). All 131 tests in `npm test`
pass (13 new, 0 regressions). `npx tsc --noEmit`, `npx eslint`, and `next
build` all clean.

**Verified live**, full loop, real cookie-jar sessions for both
`ethan@example.com` and `gabriel@greenpack.sg`: created two pending bulk
orders as Ethan (18.50 cr, 37.00 cr) → clicked the dashboard's inline
"Cancel" on the 37 cr one → moved to `cancelled` immediately, no supplier
involvement → as Gabriel, clicked Confirm on the 18.50 cr one → the new date-
picker modal opened addressed to "Ethan Goh" → submitted `2026-08-10` → row
updated to `confirmed` with "Est. delivery week of Aug 10, 2026" shown on
both the supplier and buyer sides → as Ethan, the dashboard now showed
"Request Cancellation" (not "Cancel") for the confirmed order → submitted a
reason → buyer side flipped to "Cancellation requested" → as Gabriel, the
amber warning-triangle indicator appeared next to the row's status badge →
clicked it → review modal showed "Ethan Goh has asked to cancel..." (space
confirmed present after the JSX fix) and the exact reason text → clicked
"Approve Cancellation" → row moved to `cancelled` on both sides. All scratch
rows (2 `bulk_order_requests`, 6 `activity_log` entries; zero `transactions`
since nothing was ever debited pre-fulfillment) deleted afterward via a
one-off script; Ethan's balance reconfirmed at `80`.

**Not touched:** the credit-hold mechanism (explicitly deferred, see above);
no changes to `fulfillBulkOrderWithDebit`'s debit-at-fulfillment behavior
from the prior session.

---

## Sprint 4.5 — Training Sessions: Enroll/Waitlist + Supplier Session Create/Namelist (2026-07-20)

Task brief was the sprint plan's "Build UI for training-enrollments (enroll
button + supplier-side status update)" item — `POST /api/training-enrollments`
and `PATCH /api/training-enrollments/[id]` existed with zero callers.

**Scope was bigger than the brief before any UI could be wired, confirmed by
reading the code first, not guessed:** there was no route to list training
sessions at all, no route for a user's own enrollments, and no route for a
session's participant list. The supplier Tutorials page's "Training Sessions"
tab (`CreateSessionModal`, `ViewNamelistModal`, session list) was already
built against mock data (`lib/mockTutorials.ts`) from the Sprint 3 correction
that restored these components rather than deleting them — but checking the
old Laravel backend directly (`TrainingSessionController.php`), it never had
supplier-side create/namelist routes either; only `GET /training-sessions`
(public list), `POST .../enroll`, and `GET /me/training-enrollments` existed.
So the mock UI's shape (a "listing" dropdown, an SME-email field) wasn't
something to port — it didn't map to `schema.prisma`'s actual `TrainingSession`
columns (no `listingId` relation exists at all; `endorsementName` was an
existing, previously-unused column that turned out to be exactly the old
`spacesnap-web` mockup's "endorsement" concept once cross-referenced).

**Asked the product owner three scope questions before building** (session
create/namelist backend or just the minimal enroll wiring; where the
user-facing enroll UI should live, since no page had ever shown a session to
a user; whether to reject enrollment once a session hits capacity):
- **Full build**, not minimal — also build supplier session create + a real
  participant namelist, so `CreateSessionModal`/`ViewNamelistModal` go live
  instead of staying mocked.
- **Digital Passport page** — the existing "Training Tutorials & Sessions"
  stub card there, per the old `spacesnap-web/src/pages/DigitalPassport.jsx`
  mockup the product owner pointed at directly for the intended shape
  (session cards, a detail modal with a Sign Up button, endorsement text,
  spots remaining).
- **Waitlist instead of reject.** Enrolling never fails for being full —
  once a session is at capacity it lands as `waitlisted` instead of
  `enrolled`; the supplier reviews the waitlist and approves manually. This
  is new product behavior, not a port (the old Laravel `enroll()` did reject
  with a 409 "session is full").

### Schema: `waitlisted` status + three new activity types

Migration `20260720012917_add_training_waitlist_status`: `TrainingEnrollmentStatus`
gained `waitlisted` (between `enrolled` and `awaiting_signoff`); `ActivityActionType`
gained `training_waitlisted`, `training_waitlist_approved`, `training_session_created`
— one value per hooked write-path, matching this project's existing
one-enum-value-per-event convention (see the comment above
`ActivityActionType` in `schema.prisma`). Applied to both `spacesnap_dev` and
the isolated `spacesnap_nextjs_test` DB (`npm run test:db:migrate`); dev
server restarted afterward (the standing "Prisma client doesn't hot-reload
into an already-running `next dev` process" gotcha, noted again this
session — first live PATCH attempt threw before the restart).

### `lib/training-enrollments.ts`: capacity-aware enroll + waitlist promotion

- `enrollUser` now locks the `training_sessions` row (`SELECT ... FOR UPDATE`
  raw SQL — Prisma has no `lockForUpdate` primitive) and counts "active"
  enrollments (`enrolled`/`awaiting_signoff`/`completed` — i.e. anyone
  currently holding a slot; `waitlisted` and `cancelled` don't count) before
  deciding `enrolled` vs. `waitlisted`. Mirrors old
  `TrainingSessionController::enroll`'s `lockForUpdate()` — without it, two
  concurrent enrollments racing the count could both read "under capacity"
  and both land as `enrolled`, overfilling the session. Never rejects.
- `updateEnrollmentStatus`: `enrolled` is now a valid PATCH target, but only
  as a promotion from an existing `waitlisted` row (the supplier "Approve"
  action) — every other attempt to set `enrolled` (fresh row, from
  `awaiting_signoff`, `completed`, `cancelled`) is still rejected, same as
  before this feature existed. Setting `waitlisted` directly via PATCH is
  also rejected — it's only ever assigned by `enrollUser` at creation time.
  Promoting logs `training_waitlist_approved`; no re-check against capacity
  on promotion — approving off the waitlist is a manual supplier override,
  not re-gated (confirmed acceptable live: a session can end up showing
  more enrolled than its stated capacity if a supplier chooses to approve
  anyway, e.g. "2 / 1" — read as an honest count, not a bug).

### New `lib/training-sessions.ts`

- `serializePublicTrainingSession` — counts only (`enrolledCount`,
  `waitlistCount`), never the raw participant list or other users' ids, so
  browsing sessions can't double as a way to enumerate who's enrolled where.
  Merges `myEnrollmentStatus` when a viewer id is passed.
- `serializeSupplierTrainingSession` — the real namelist (`enrollmentId`,
  `userName`, `userEmail`, `status`) for the caller's own company only.
- Both derive `past`/`full`/`open` from `sessionDatetime`/`capacity` vs. the
  active count — `TrainingSession` has no stored status column (confirmed by
  grep) and no cancel-session feature exists (the old backend never had one
  either), so this is always computed, never a field a supplier sets.
- `createTrainingSession` — gates `certificateId` to certificates with
  `earningMethod: tier2b_operator_or_sme_signoff` (`CertificateNotEligibleForSessionError`
  otherwise). tier1 is auto-graded (no session involved) and tier2a is a
  per-user on-demand review (`CertificateSignoffRequest`), neither is a
  scheduled multi-participant session — see "Sprint 4, Item 4, Correction"
  above for why these three paths are kept distinct. Logs
  `training_session_created` under the creating supplier's own `userId`
  (the closest precedent, `POST /api/certificates`, doesn't log at all; this
  one does, since it's a real state-changing write worth an audit trail,
  same reasoning as every other create/confirm/decline action in this app).

### New routes

`GET /api/training-sessions` (public, no auth required — mirrors the old
unauthenticated `index()`; merges the caller's own status when a session
exists). `GET`+`POST /api/supplier/training-sessions` (company-scoped via
`requireSupplier()`, which now also returns `userId` alongside `companyId` —
a small, backward-compatible addition to the shared helper, needed here for
the activity-log `createdByUserId`). `PATCH /api/training-enrollments/[id]`'s
`UPDATABLE_STATUSES` changed from "all except `enrolled`" to "all except
`waitlisted`" — `updateEnrollmentStatus` itself still enforces that
`enrolled` is only reachable from `waitlisted`.

### Frontend

`lib/hooks/useTrainingSessions.ts` (public list + enroll mutation) and
`lib/hooks/useSupplierTrainingSessions.ts` (supplier list + create +
status-update mutations) — same `apiFetch`/React Query
invalidate-on-success shape as `useSupplierBulkOrders.ts`.

**Digital Passport page** (`app/(user)/passport/page.tsx`): split the old
stub card into two — "Training Tutorials" stays stubbed (the video-catalog
gap is untouched, separate scope) and a new real "Training Sessions" card:
a session grid (`SessionCard`) and a detail modal (`SessionDetailModal`)
with a status-aware action button — "Sign Up for this Session" (open, not
enrolled), "Join Waitlist" (full, not enrolled), or a disabled label
matching whatever the caller's own status already is (`Already Enrolled`,
`On Waitlist`, `Awaiting Sign-off`, `Completed`, `Enrollment Cancelled`,
or `Session Has Passed` once `sessionDatetime` is in the past). Modelled on
`spacesnap-web/src/pages/DigitalPassport.jsx`'s `SessionCard`/
`SessionDetailModal` shape per the product owner's pointer, not copied
verbatim (real data, real endorsement/certificate fields, no `expert`/host
fields that don't exist here — SME name and host company name are used
instead).

**Supplier Tutorials page** (`app/(supplier)/supplier-tutorials/page.tsx`):
the "Training Sessions" tab now reads `useSupplierTrainingSessions()`
instead of `MOCK_TRAINING_SESSIONS`. Rewrote `CreateSessionModal` (dropped
the "Equipment / Listing" dropdown — no `listingId` column exists — and the
"SME Email" field — no email-dispatch capability in this codebase; added a
free-text `title` field and the "Endorsement Name" field, both real
columns; the certificate dropdown is filtered client-side to
`tier2b_operator_or_sme_signoff` certs from the existing
`useCertificateCatalog()` hook) and `ViewNamelistModal` (real participants,
a `Waitlisted` status badge, and per-status action buttons: `Approve`/
`Reject` for waitlisted rows, `Awaiting Sign-off`/`Pass`/`Fail` for
enrolled/awaiting_signoff rows, nothing for terminal `completed`/`cancelled`
rows). Dropped the old mock UI's "SME Signed Off / Copy SME Link" toggle
entirely — no session-level signoff flag or link-generation capability
exists in this schema, and inventing one wasn't asked for. Video Tutorials
tab is untouched, still mock-wired (separate, already-tracked gap).

### Tests

`lib/training-enrollments.test.ts` — 5 new cases: waitlists past capacity
instead of rejecting; `awaiting_signoff` counts toward capacity while
`cancelled` frees it (and a freed slot does *not* auto-promote the
waitlisted row — promotion stays a manual supplier action); a supplier can
promote waitlisted → enrolled; promoting to `enrolled` from any other status
is rejected; setting `waitlisted` directly via `updateEnrollmentStatus` is
rejected. New `lib/training-sessions.test.ts` — field validation
(`parseCreateSessionFields`) plus `createTrainingSession` happy path,
ineligible-certificate rejection, and nonexistent-certificate rejection,
each confirming nothing is written on rejection. Both added to `npm test`.
All 144 tests pass (13 new, 0 regressions). `npx tsc --noEmit`, `npx eslint`,
and `next build` all clean (the one pre-existing lint error in
`passport/page.tsx`, a `react-hooks/set-state-in-effect` finding on the
unrelated `filterCertId` deep-link effect, was confirmed pre-existing via
`git stash` before/after — not introduced or touched this session).

**Verified live**, full loop, real cookie-jar sessions in the browser (not
just unit tests) — `gabriel@greenpack.sg` (GreenPack, a company with zero
prior sessions, confirmed via the empty state "No training sessions yet")
created "GreenPack Fire Marshal Workshop" against the seeded Fire Safety
Marshal cert (the only seeded `tier2b_operator_or_sme_signoff` certificate)
with `capacity: 1` → session appeared with `0 / 1`, `Open`. As
`ethan@example.com`: opened the session on `/passport`, clicked "Sign Up for
this Session" → card flipped to `Enrolled`, `1 / 1`, modal showed "Already
Enrolled" (disabled) and "You're enrolled!". As `farah@example.com`: same
session now showed `Full`; clicked "Join Waitlist" (not blocked) → card
showed `Waitlisted`, `1 / 1 enrolled · 1 waitlisted`, modal confirmed "You're
on the waitlist — the supplier will approve you if a spot opens up." Back as
Gabriel on `/supplier-tutorials`: namelist showed both Ethan (`Enrolled`,
with Awaiting Sign-off/Pass/Fail buttons) and Farah (`Waitlisted`, with
Approve/Reject) → clicked Approve on Farah → she flipped to `Enrolled`
immediately (row now reads `2 / 1`, the intentional-overbook case noted
above) → clicked Pass on Ethan → he flipped to `Passed` (terminal, no more
buttons); confirmed via direct DB query that Ethan's `Fire Safety Marshal`
`user_certificates` row was renewed (`earned_date` moved to today), same
`issueCredential` upsert path as every other sign-off completion. All
scratch state (the test session, both enrollments, the 5 activity_log rows,
Ethan's credential dates) deleted/restored afterward via direct SQL; DB
confirmed back to seeded state (`ethan`'s Fire Safety Marshal credential
back to `earned_date 2025-01-10` / `expiry_date 2026-01-10`, zero leftover
`training_sessions` rows for GreenPack).

**Not touched:** Video Tutorials (both pages, still mock — separate,
already-tracked gap); no changes to the tier1 (`quiz-attempts.ts`) or tier2a
(`certificate-signoffs.ts`) earning paths.

---

## Sprint 4.5 — Activity Log Read Endpoint + Recent Activity Feed UI (2026-07-20)

Task brief was the sprint plan's two remaining Sprint 4.5 items: add an
`activity_log` GET endpoint, and decide/build a feed UI for it. `ActivityLog`
had been write-only since Sprint 3.5 — every credit/booking/training/
certificate-affecting action already writes a row (`lib/bookings.ts`,
`lib/bulk-orders.ts`, `lib/wallet.ts`, `lib/check-ins.ts`,
`lib/training-enrollments.ts`, `lib/training-sessions.ts`,
`lib/certificate-signoffs.ts`, `lib/quiz-attempts.ts`, `lib/purchases.ts`,
`lib/training-credentials.ts`) — with nothing to read them back.

**Scope correction from the user mid-session, twice:** the first plan treated
the dashboard's existing "Recent Activity" card (bookings-only, with inline
rating) as basically fine and the new feed as a separate concept. Corrected:
"Recent Activity" should show *all* activity types (top-ups, training
sign-ups, etc.), not just bookings — booking rows just happen to carry the
rating control when applicable. Second correction: added a requirement for
category filter pills and a date-range filter (7 days / 30 days / quarter)
so the merged, all-types feed doesn't grow unbounded. Both folded into the
one card rather than building two.

### Backend: `GET /api/activity`

`lib/activity.ts` — `parseActivityQuery` validates `?types=` (CSV against
the real `ActivityActionType` enum, 422 on an unknown value),
`?days=` (positive integer → `createdAt >= now - days`), `?limit=` (default
100, capped 200); all three optional (omitting `types`/`days` means every
type / all time, matching how the frontend's "All" and "All time" pills
work). `getUserActivity` is a straight `findMany` scoped to the caller's own
`userId`, join `listing.name` (many action types carry `relatedListingId`)
so the UI doesn't have to do a second round-trip just to show a listing
name next to a description. `app/api/activity/route.ts` is the same
auth-then-delegate shape as every other GET route in this codebase (`/api/
wallet`, `/api/bookings`).

**Deliberately not done:** no schema change. `ActivityLog` has no
`bookingId` column (only `relatedListingId`, shared across many action
types) — adding one to link feed rows straight to a booking was considered
and rejected as more invasive than the ask warranted. Instead, the rating
merge (below) reads the booking id out of the description text this
codebase already writes (`Booking #${id} ...`, see `lib/bookings.ts`'s three
`activityLog.create` calls) via a regex, cross-referenced against
`GET /api/bookings` (already fetched on this page for the "Total Bookings"
stat). If the description format ever changes, `matchBookingId` in
`app/(user)/user/page.tsx` needs to change with it — a real coupling, judged
acceptable since both live in this codebase and the format is old/stable
(Sprint 3.5).

### Frontend: category + date-range pills, rating still inline on booking rows

`lib/hooks/useActivity.ts` — mirrors the Prisma `ActivityActionType` enum as
a hand-kept string union (same convention as `BookingStatus` in
`useUserBookings.ts`; frontend code doesn't import the generated Prisma
client). `ACTIVITY_CATEGORIES` groups the 23 action types into 7
user-facing buckets (Bookings, Bulk Orders, Purchases, Wallet, Check-ins,
Training, Certificates) — pure display/filter data, not sent to the API as
a concept; the hook expands a category into its raw `types` list before
building the querystring, so adding a category later never needs a backend
change. `ACTIVITY_DATE_RANGES` is the 7/30/90-day + all-time set the user
asked for.

`app/(user)/user/page.tsx`'s "Recent Activity" card: `Pills` (a small
generic component, same pattern as `FilterPills` in
`app/(supplier)/supplier-requests/page.tsx`, restyled to this page's teal
accent) renders both filter rows. Default date range is **30 days** (not
"all time") — the reason the date filter was asked for in the first place.
`ActivityRow` renders a per-type icon (`ACTIVITY_ICONS`, all in the page's
existing teal-circle style — icon shape varies, color doesn't, matching how
the old bookings/bulk-order rows already looked), the listing name when
present (falling back to the raw description as the headline if there's no
related listing, e.g. wallet top-ups), and the full description as a
secondary line. For `booking_created`/`booking_confirmed`/`booking_declined`
rows specifically, it looks up the matched booking in a `bookingsById` map
and — if found — shows the booking's status badge plus, when `completed`
and not a consumables listing, the same rating control the old
`BookingActivityRow` had (read-only stars if already rated, an interactive
`RatingStars` + `useSubmitRating` mutation if not).

### Verified live, full loop, not just typechecked

Real cookie-jar session as `ethan@example.com` against the dev server/DB:
confirmed the existing single leftover `credential_issued` row (a residual
from an earlier session's certificate-signoff testing, correctly excluded
from seed data — `prisma/seed.ts` never writes `ActivityLog`, confirmed by
grep) showed up correctly with its icon and fell out of the "Bookings"
category filter. Then generated fresh activity end-to-end: `POST /api/wallet/
topup` (10 cr) → `POST /api/bookings` on listing 165 (Power Drill Set, no
cert requirement) → confirmed as `divya@toolshare.sg` (a plain booking
confirm — `estimatedDeliveryDate` is bulk-order-only, doesn't apply here)
→ checked in and checked out as Ethan to reach `completed`. Reloaded
`/user`: all 6 rows appeared in the right order (check_out, check_in,
booking_confirmed, booking_created, wallet_topup, the older credential_issued
row), each with the correct icon/listing name. The two booking-family rows
both correctly resolved to booking #157, both showed a `Completed` badge and
an interactive rating control. Clicked 4 stars on one — both rows updated to
the same read-only 4-star display simultaneously (confirms both derive from
the one `useUserBookings` query, not independent state). Switched the
category pill to "Bookings" — list correctly narrowed to just the two
booking rows, everything else (check-ins, top-up, credential) dropped out.
Also verified the API directly: `?types=bogus_type` → clean `422
{"errors":{"types":["Unknown activity type(s): bogus_type."]}}`, not a raw
error; `?days=7` correctly excluded the older credential row while including
everything from this session's test run.

All scratch state deleted afterward via a one-off `tsx` script (booking 157,
its rating, check-in, the two `transactions` rows, and every `activity_log`
row this session generated) — confirmed zero remaining `activity_log` rows
referencing "Booking #157" and Ethan's ledger balance back to the seeded
`80`. The pre-existing `credential_issued` leftover from an earlier session
was left alone (not this session's mess to clean up, and still useful as a
real non-booking feed example).

`npx tsc --noEmit`, `npx eslint`, `npm test` (144/144, 0 regressions), and
`next build` all clean.

**Not touched:** no changes to any `activityLog.create` call site (the write
side was already correct and complete from Sprint 3.5 onward); the
"Currently Active" card's own gap (no GET for active check-ins) is untouched
and separately tracked; Video Tutorials mock-data gap untouched.

---

## Video Tutorials — TrainingVideo/Quiz Backend + Supplier/Admin/User UI (2026-07-20)

Closed the Video Tutorials mock-data gap tracked since Sprint 3 Session 4
("supplier Tutorials page and the admin Certificates & Training 'Training
Videos' tab... both intentionally left on mock data"). Confirmed the
"Currently Active" check-ins gap is a *different*, still-blocked item (Trust
Architecture: `CheckIn` rows are only ever supposed to be written by the
kiosk Pi, Sprint 5 — not something to build a web UI for now), not this one.

**Schema was already fully built**, ahead of this session — `TrainingVideo`,
`VideoCompletion`, `QuizQuestion`, `QuizAnswer` all existed from earlier
Sprint 4 work (the tier1_video_quiz earning path, `lib/quiz-attempts.ts`),
just with no CRUD routes exposing them beyond the single existing
`POST /api/training-videos/[id]/quiz-attempts`. No migration needed.

**What was built:**
- `lib/training-videos.ts` — `serializeTrainingVideo` (conditional company/
  counts/viewer sections, same idiom as `serializeCertificate`),
  `parseTrainingVideoFields` (mirrors old `TrainingVideoController::rules()`:
  title/category required on create, "sometimes" on update), CRUD functions
  (`createTrainingVideo`, `updateTrainingVideoAsSupplier` — company-ownership
  checked, `updateTrainingVideoAsAdmin`, `deleteTrainingVideoAsAdmin`),
  `TrainingVideoNotFoundError`/`TrainingVideoNotOwnedError`. `deriveViewerState`
  is the one genuinely new rule: a quiz-backed video counts as "completed"
  only via a *passing* `QuizAttempt`, never via `VideoCompletion` — the two
  completion mechanisms are for different video shapes (informational vs.
  quiz-gated), not redundant paths to the same state.
- `lib/quiz-questions.ts` — `parseQuizQuestionsSubmission` (min 15 questions,
  exactly 4 options each, `correctIndex` 0-3, mirrors old
  `QuizQuestionController`'s validation exactly, confirmed against
  `TrainingVideoQuizTest.php` in `spacesnap-api`) and replace-all
  `saveQuizQuestionsAsSupplier`/`AsAdmin` (delete-then-recreate in one
  transaction, same semantics as the old backend — a video's quiz has no
  incremental-edit affordance anywhere in this app).
- Routes: public `GET /api/training-videos` (catalog, viewer-merged
  completedByMe/myLatestQuizAttempt — requires auth, a deliberate deviation
  from the old backend's unauthenticated `index()`, since every page that
  reaches this in this app already sits behind route protection, and it lets
  one request carry the viewer's own state instead of a second round trip),
  `GET /api/training-videos/[id]` (detail + taker-safe quiz questions, no
  `isCorrect`), `POST .../complete` (VideoCompletion upsert), supplier
  `POST/PATCH /api/supplier/training-videos[/[id]]` +
  `POST .../[id]/quiz-questions`, admin `GET/POST /api/admin/training-videos`
  + `PATCH/DELETE [id]` + `POST [id]/quiz-questions` (first `DELETE` route in
  this codebase — admin-only, matching the old backend, suppliers never had
  delete even for their own uploads).
- Frontend: `lib/hooks/useTrainingVideos.ts` (public list/detail/complete/
  quiz-attempt-submit), `useSupplierTrainingVideos.ts`, `useAdminTrainingVideos.ts`.
  `UploadVideoModal.tsx` and `AdminCertificatesTraining.tsx`'s video tab
  rewired from local mock state to these hooks — no UI redesign, the
  existing two-step `TrainingVideoModal`/`QuizBuilderStep` flow (built during
  the Sprint 3 correction) needed only its `saveVideo`/`saveQuiz` stubs
  replaced with real mutations. `TrainingVideoModal`'s generic id type
  switched from `number` (mock `Date.now()` ids) to `string` (real
  BigInt-backed ids) — the one non-cosmetic change to that shared component.
  Supplier Tutorials page's Video Tutorials tab now reads
  `useTrainingVideos()` directly (no supplier-scoped "my videos" list exists
  in this app, matching the old backend — suppliers browse the same
  platform-wide catalog everyone sees, same as admin's read side).
- **New, not a port** — the Digital Passport page's "Training Tutorials" card
  was a stub with no mock data at all (explicitly flagged as not-even-mocked
  in Sprint 3 Session 5). Built the real quiz-taking flow: `TutorialCard`
  grid + `TutorialDetailModal` (two-step: "watch" — video placeholder +
  either "Mark as Watched" for informational videos or "Take the Quiz" for
  quiz-backed ones; "quiz" — radio-button questions sourced from the detail
  endpoint, submits to the existing `POST .../quiz-attempts`, shows pass/
  fail + credential-issued messaging). Modeled on the old
  `spacesnap-web/src/pages/DigitalPassport.jsx` `TutorialModal`/`QuizModal`
  mock shape (product owner's established reference pattern for this page,
  per the earlier Training Sessions session), now against real data.

**Real bug found and fixed during live verification, not just in new code:**
`useCompleteTrainingVideo`/`useSubmitQuizAttempt` only invalidated the
`["training-videos"]` list query on success, not `["training-video-detail",
id]` — the *open modal* reads from the detail query, so after marking a
video watched (or passing its quiz), the modal's own button stayed on "I've
Understood the Contents" until closed and reopened, even though the list
behind it had already updated. Caught by actually watching the button after
a real mutation, not just checking the network tab returned 200. Fixed by
invalidating both query keys.

**Second real bug found live:** the category filter pills (`?category=`)
did an exact-match `where: { category }` — the upload form's
`VIDEO_CATEGORIES` dropdown submits capitalized values ("Safety") but seeded
`TrainingVideo` rows use lowercase ("safety"), so clicking the "Safety"
filter pill hid every seeded safety video and showed only videos created
through the new form. Fixed both `GET /api/training-videos` and
`GET /api/admin/training-videos` to use `{ equals: category, mode:
"insensitive" }`, matching the case-insensitive search pattern already used
in `GET /api/admin/certificates`.

**Cleanup:** `lib/mockTutorials.ts` trimmed to just the still-live
quiz-authoring types/helpers (`QuizQuestion`, `QuizAnswer`,
`makeBlankQuizQuestion`, `VideoCategory`, `VIDEO_CATEGORIES` — still used by
`QuizBuilderStep`/`TrainingVideoModal`/both upload flows). Deleted
`MOCK_TUTORIAL_VIDEOS`, `MOCK_ADMIN_TRAINING_VIDEOS`, and the already-dead
`MOCK_TRAINING_SESSIONS`/`SESSION_LISTING_OPTIONS`/`SESSION_CERTIFICATE_OPTIONS`
(superseded by the real API, confirmed zero remaining imports via grep first
— valid per this repo's standing "only delete on real supersession" rule,
not the "no backend exists yet" reasoning that rule was written to forbid).

**Tests:** `lib/training-videos.test.ts` (parse validation, supplier/admin
CRUD ownership rules, `deriveViewerState`) and `lib/quiz-questions.test.ts`
(submission validation matching the old backend's matrix, replace-all save
semantics including the resave-replaces-everything case), both against the
real test DB, added to `npm test`. All 171 tests pass (27 new, 0
regressions). `npx tsc --noEmit`, `npx eslint .` (only the pre-existing,
unrelated `passport/page.tsx` cert-filter-effect finding, confirmed
untouched by this session), and `next build` all clean.

**Verified live**, full loop, real cookie-jar sessions for all three roles
against the dev server/DB — not just unit tests:
- `ethan@example.com`: watched "Chemical Storage Guidelines" (no quiz) →
  modal correctly flipped to "Completed"/"Already Watched" after the fix
  above; passed "Forklift Operation Basics"' real 4-question seeded quiz
  (looked up the actual answer key via a scratch script, not guessed) →
  "Passed! Scored 4/4."; card grid showed both as Completed on next render.
- `ben@acmecoworking.sg` (supplier): Upload Video → 201, video appeared in
  the grid immediately (no reload) with 0 completions.
- `alice.admin@spacesnap.sg`: Add Video → Build a real 15-question quiz (hit
  the exact minimum, one correct answer each) → Save Quiz → 201; Edit →
  title change → 200; Delete → confirm modal showed the right title → 204,
  cascade-deleted the quiz questions/answers, video gone from the grid.
- Category filter re-verified after the case-insensitive fix: clicking
  "Safety" now correctly shows all 3 seeded safety-category videos
  regardless of casing.

All scratch state cleaned up afterward: the `VideoCompletion`/`QuizAttempt`/
`ActivityLog` rows from Ethan's test run deleted via a scratch script,
Ethan's original seeded `VideoCompletion` row (Workplace Safety 101,
2026-01-14 — an inert row given `deriveViewerState`'s rule above, since that
video has a quiz, but still part of the canonical seed fixture) restored
after an over-broad first cleanup pass deleted it alongside the actual test
artifact; the admin-created 15-question test video deleted via the UI's own
Delete flow (204, cascade). Final DB check: `training_videos` 3,
`quiz_questions` 8, `quiz_answers` 32, `quiz_attempts` 0, `video_completions`
3 — byte-identical counts to the pre-session seeded state.

**Not touched:** Video upload itself (`Video upload coming soon` /
`Thumbnail upload coming soon` dropzones stay disabled placeholders — R2
file upload is separate, unbuilt scope, not something this session invented
a workaround for); no changes to `lib/quiz-attempts.ts`'s grading logic
(already correct from Sprint 4 Item 4); "Currently Active" check-ins gap
remains blocked on Sprint 5 kiosk hardware, not something this session's
scope covered.

## Backend CRUD Pass — Admin Companies, Promotions, Revenue Aggregation, Business Details (2026-07-20)

Closed four of the "deliberately left unwired" backend gaps tracked in
`SPRINT_PLAN_NEXTJS_REWRITE.md` since Sprint 3 Session 4, done as four
sequential sub-sessions (each typechecked/linted/tested/verified live before
moving to the next), per product owner direction. Admin-level booking
approval (the fifth item in that list) was explicitly **rejected** by the
product owner this session — bookings stay supplier-owned, confirmed as a
non-feature rather than left unwired.

### 1. `GET /api/admin/companies` + Companies tab

`lib/admin-companies.ts` (`serializeAdminCompany`/`serializeAdminCompanyMember`,
reusing `deriveRole` from `lib/admin-users.ts`) + `app/api/admin/companies/route.ts`
(`requireSystemAdmin`, optional `?search=` on name/businessName) +
`lib/hooks/useAdminCompanies.ts`. `AdminUsersCompanies.tsx`'s `CompaniesTab`
rewritten from a gap-note stub to an expandable table (company row → nested
member roster with role/status badges), same interaction pattern as the
existing Users tab. Verified live: 401 unauthenticated, search narrows
correctly, expand shows Acme's real 2 members (Ben/Company Admin,
Chandra/Supplier) with no console errors.

### 2. Promotion request loop

`lib/promotions.ts` (`requestPromotion`/`getPendingPromotions`/
`approvePromotion`/`rejectPromotion`, three typed errors —
`AlreadyCompanyAdminError`/`PromotionAlreadyRequestedError`/
`PromotionNotPendingError`) + `POST /api/promotion-request` (self-service,
`requireSupplier`) + `GET /api/admin/promotions/pending` +
`PATCH .../[id]/approve` + `.../reject` (`requireSystemAdmin`). Approve sets
`isCompanyAdmin: true` and clears the flag; reject only clears the flag.
`GET /api/me` now also returns `promotionRequested` so the supplier-profile
button's state survives a reload, not just local mutation state.

Wired into all three touch points: Supplier Profile's
`CompanyAdminAccessCard` (button → "Request Pending" → gone once resolved),
Admin Approvals' new `PromotionsTab` (mirrors the existing `CertificatesTab`
approve/reject pattern), and the Admin Overview dashboard's "Company Admin
Promotion Requests" row (was hardcoded `count={null}`/"not wired yet").

**Verified live, full loop, not just unit-level**: reset Chandra
(`chandra@acmecoworking.sg`, the one seeded plain-supplier account — every
other seeded supplier is already a company admin) to a clean pre-request
state via a one-off script, then drove the actual UI: logged in as Chandra,
clicked "Request Promotion to Company Admin" → button flipped to "Request
Pending", persisted across reload (confirms real DB read, not local state).
Logged in as admin, saw "Promotions 1" badge on Approvals, approved via the
UI → Chandra's session (`/api/auth/session`) confirmed `isCompanyAdmin: true`
on next read (the `jwt` callback's per-read DB check picked it up
automatically, no re-login needed). Re-ran the same flow and rejected
instead this time (via API, since approve already proved the UI path) —
confirmed role stayed `supplier` and the flag cleared. Edge cases exercised
directly: non-supplier requesting → 403, already-company-admin requesting →
422, requesting twice → 422, non-admin hitting the admin routes → 403,
approving/rejecting a non-pending user → 422, a nonexistent user id → 404,
unauthenticated → 401. Chandra ended the session back at her original
seeded state (`isCompanyAdmin: false`, `promotionRequested: false`) via the
reject call itself, no manual DB cleanup needed.

### 3. Revenue/booking aggregation

`lib/revenue.ts` — "revenue" is defined as `type IN (booking, purchase,
refund)` transactions, negated and summed (`topup` excluded — that's money
entering a user's own wallet, not operator revenue). Company attribution
resolves through whichever of `Transaction.booking`/`bulkOrderRequest`/
`purchase` is set, down to that record's `listing.companyId` — there's no
`companyId` column on `Transaction` itself, so this can't be a Prisma
`groupBy`; it's a fetch-all-then-reduce-in-JS given the current (dev/demo)
data volume, same idiom as other pure-JS aggregation in this codebase.
Three exports: `getPlatformRevenueSummary` (companies/bookings/revenue
counts), `getRevenueByCompany` (every company, zero-revenue ones included),
`getRevenueTransactionFeed` (recent non-zero revenue transactions with
company attribution), `getCompanyRevenueByMonth` (single company, last 6
calendar months, zero-filled).

Routes: `GET /api/admin/financials` (all three admin-facing shapes in one
call — backs both the Overview stat cards and the Financials page) and
`GET /api/supplier/revenue` (`requireSupplier`, scoped to caller's own
company). Frontend: `useAdminFinancials`/`useSupplierRevenue` hooks; Admin
Overview's three "—" stat cards now show real numbers; Admin Financials page
rebuilt from a single gap-note into a revenue-by-operator table + a
cross-company transaction feed table; Supplier Dashboard's "Revenue Over
Time" gap note replaced with a `recharts` `BarChart` (recharts was already a
listed dependency, unused until now).

**Real bug found and fixed during live verification**: the bar chart
rendered with axis/gridlines but no visible bar on first load. Traced via
direct SVG-coordinate inspection (grid line `y` attributes vs. the bar
rect's `y`/`height`) to Recharts' default mount animation depending on
`requestAnimationFrame` — which stalls in this automated browser tool,
leaving the bar stuck mid-animation or at zero height depending on timing.
Fixed with `isAnimationActive={false}` on the `<Bar>` (also just better for
a dashboard chart — no reason to animate in on every load). Re-verified:
bar renders at full height immediately, correctly proportioned against the
600-unit axis for Acme's 420cr July total.

**Real data quirk found, not a bug**: one seeded demo `Transaction`
(`"Bulk order: Compostable Packaging Boxes x20 packs"`, -370, Farah's user)
has no linked `Purchase`/`BulkOrderRequest` row at all — predates those
tables, kept in `prisma/seed.ts` as decorative ledger noise. It correctly
shows `companyId: null` / "—" in the transaction feed and is included in
platform-total revenue but not in any per-operator row — meaning the
platform total can legitimately exceed the sum of the by-company table.
Not fixed (not this session's data to clean up, and the aggregation code is
behaving correctly given what the row actually links to) — flagged here so
a future session doesn't mistake the discrepancy for a bug.

Verified live: Admin Overview → Total Companies 3, Total Bookings 5,
Platform Revenue 1740.00 cr. Admin Financials → Acme 420.00 cr, GreenPack
0.00 cr, ToolShare 950.00 cr (420+0+950=1370, the 370cr gap being the
orphaned row above), transaction feed showing per-row company attribution
correctly. Supplier Dashboard (`ben@acmecoworking.sg`) → bar chart showing
Jul 420cr, Feb–Jun at 0.

### 4. Business Details edit

New migration `20260720105222_add_company_finance_fields` — added
`registrationNumber`/`financeContactEmail`/`financeContactPerson` to
`Company` (all nullable `String?`, `businessLocation`/`yearsOperating`
deliberately excluded from this pass per product owner call, even though the
old gap note bundled them together). Applied to both `spacesnap_dev` and
`spacesnap_nextjs_test` (`npm run test:db:migrate`), `prisma generate` rerun.

New `requireCompanyAdmin()` in `lib/supplier-auth.ts` (stricter than the
existing `requireSupplier()` — same company-scoping, plus `isCompanyAdmin`)
since editing a company's business/finance details is a company-admin action,
not a plain-supplier one — but *viewing* them isn't restricted, any supplier
at the company can read. `lib/company.ts`
(`serializeCompanyDetails`/`parseBusinessDetailsFields`/
`updateCompanyBusinessDetails`) + `GET`+`PATCH /api/supplier/company`.
Supplier Profile's `BusinessDetailsCard` replaces the old gap-note Card:
read-only list for any supplier, an "Edit" button + form (only the 5 target
fields) for company admins, with a "only your company admin can edit" hint
for everyone else.

**Real bug found and fixed during live verification**: first PATCH attempt
(as `ben@acmecoworking.sg`, a real company admin) 500'd —
`PrismaClientValidationError: Unknown argument registrationNumber`. Not a
code bug: the already-running dev server's Node process had the *old*
generated Prisma Client loaded in memory from before this session's
migration/`prisma generate`, and Next's dev-server module cache doesn't pick
up a regenerated client without a process restart (unlike a normal HMR
source edit). Fixed by stopping and restarting the preview server; re-ran
the identical PATCH and it succeeded.

Verified live, full loop: as Ben, edited all three new fields
(`UEN-2019-0042` / `finance@acmecoworking.sg` / `Priya Nathan`) via the real
UI form → saved → persisted across a page reload (confirms real DB write).
As Chandra (plain supplier, same company): `GET` succeeds and shows Ben's
saved values (read access isn't admin-gated), `PATCH` → clean `403 "This
action requires company admin access."` Unauthenticated `GET` → `401`.
Reverted Acme's three new fields back to `null` via the same PATCH endpoint
afterward (the app's own clear-a-field-with-null path), confirmed by the
response — DB back to its pre-session seeded state, no manual SQL needed.

### Wrap-up

`npx tsc --noEmit`, `npx eslint .` (only pre-existing findings in untouched
files — `passport/page.tsx`, `prisma/seed.ts`, `prisma/tests/db-constraints.test.ts`
— confirmed unrelated to this session), `npm test` (171/171, zero
regressions across all four sub-sessions), and `next build` all clean.

**Not touched, flagged rather than silently skipped:** the Invoice/Receipt/
payout gap (Sprint 6, Stripe, genuinely unbuilt) is the only item left in
the Sprint 3 "backend gaps" list — a candidate for that sprint, not before.
The `businessLocation`/`yearsOperating` Company columns still exist but
aren't exposed by the new edit form (product owner's explicit scope call,
not an oversight). The supplier-profile "Average Rating: No rating system
built yet" line is now stale — ratings shipped in Sprint 4.5 — noticed in
passing but out of this session's scope to fix.

## Credit Hold on Bulk-Order Confirmation (2026-07-20)

Closed the Sprint 4.5 "approved in principle, deferred" item: confirming a
bulk order now places a hold on the buyer's credit rather than leaving
confirm as a pure status transition. Scoped with the product owner via a
round of explicit design questions before writing any code (data model,
whether confirm should hard-block or warn, stale-hold handling, wallet
visibility), then built same session.

**Design decisions, all confirmed with the product owner first:**
- **Separate `CreditHold` model**, not a `Transaction` row — `Transaction`
  stays "money that actually moved" (per its own schema comment); a hold is
  a reservation against money that hasn't moved yet. `available balance =
  live Transaction SUM - active, non-expired holds for that user`.
- **Confirm warns, doesn't hard-block.** If available balance is short, the
  route returns a clean `409 { requiresOverride, available, required }`
  instead of confirming. The supplier can resubmit with `override: true` to
  push it through anyway — the hold is still placed either way once confirm
  actually succeeds.
- **Override writes an audit-trail row**, not just a silent flag — a new
  `ActivityActionType` value, `bulk_order_confirmed_despite_insufficient_credit`.
  **Deliberately logged under the buyer's `userId`, not the supplier's** —
  a refinement over the initial framing ("logged under the supplier, the
  actor"): every other `bulk_order_*` activity type in this codebase is
  buyer-scoped and surfaces in the user dashboard's Recent Activity feed
  (Sprint 4.5); there's no equivalent supplier-facing activity UI anywhere
  in the app, so a supplier-scoped row would be queryable via the API but
  invisible to anyone. Buyer-scoped means the buyer actually sees "you were
  confirmed despite insufficient credit" in their own feed — a more useful
  trail in practice, and consistent with the family of events it belongs to.
- **Stale holds auto-expire after 7 days, released lazily.** No
  scheduled-job infrastructure exists anywhere in this codebase (confirmed
  before choosing this over a real cron), so
  `releaseExpiredHoldsForUser` runs at the start of every
  `getAvailableCreditBalance` read — same "always a live computation, never
  cached" idiom `lib/credits.ts` already uses for the ledger balance itself.
  A hold can look "active" for up to 7 days past its true expiry if nobody
  reads that user's balance in the meantime, but is never wrong once
  actually checked.
- **Wallet shows available/held/total**, not just one balance number.

**What was built:**
- Migration `20260720111342_add_credit_holds`: `CreditHold` (`userId`,
  `bulkOrderRequestId` unique, `amount`, `status` active/released,
  `createdAt`, `expiresAt`, `releasedAt`) + the new `ActivityActionType`
  value. Applied to both `spacesnap_dev` and the isolated test DB.
- `lib/credit-holds.ts` — `getAvailableCreditBalance` (releases expired
  holds first, then live-balance-minus-active-holds), `createHold`,
  `releaseHoldForBulkOrder` (idempotent no-op if nothing's active — a hold
  may have already lazily expired by the time a release point runs),
  `InsufficientAvailableCreditError`.
- `lib/bulk-orders.ts`: `confirmBulkOrder` gained an `options.override`
  param, checks available balance, creates the hold, and — only on an
  actual override — writes the second activity-log row.
  `fulfillBulkOrderWithDebit`/`declineBulkOrder`/`approveBulkOrderCancellation`
  each now call `releaseHoldForBulkOrder`. `fulfillBulkOrderWithDebit`
  deliberately still checks the *real* ledger balance via
  `assertSufficientBalance`, unchanged — the hold only ever gated the
  confirm decision, not whether the debit can actually go through later.
- `GET /api/wallet` returns `held`/`available` alongside the existing
  `balance`; `PATCH .../confirm` accepts `override` in the body and returns
  the `409`/warning shape on insufficient available credit.
- Frontend: `ConfirmBulkOrderModal` gained a warning-banner state (amber,
  `AlertTriangle`) with a "Confirm Anyway" button that resubmits with
  `override: true`; wallet page splits the hero number into
  Available/held/total.

**Real bug found and fixed during live verification, same root cause as an
already-documented one:** the "Confirm Anyway" button, styled with
`!bg-amber` against `Button`'s `primary` variant, rendered teal instead of
amber — `getComputedStyle` showed `background-color: rgb(245,158,11)`
(correct) but `background-image: linear-gradient(...)` (the variant's teal
gradient) painted over it, since `!bg-amber` only overrides
`background-color`. Identical root cause to the Fulfill-button gradient bug
from the "Bulk Order Cancellation Flow" session above. That session's fix
was switching to `variant="ghost"`; this one instead added `!bg-none`
alongside `!bg-amber` to explicitly clear the gradient image first. Caught
via `getComputedStyle` in the live browser, not by eyeballing a screenshot —
same lesson as before, a screenshot alone reads as "close enough" when it's
actually wrong.

**Tests:** new `lib/credit-holds.test.ts` (14 cases: zero-state, active hold
reduces available not ledger balance, expired-hold lazy release, confirm
with/without sufficient balance, override creates the hold and logs the
audit row, a second confirm blocked by the first request's hold even though
the raw ledger balance alone would cover it, all three release points, and
`getCreditBalance` staying unaffected by holds) — real dev-Postgres DB via
Prisma, no mocking, same convention as every other lib test in this repo.
Every pre-existing `confirmBulkOrder` call in `lib/bulk-orders.test.ts` now
passes `{ override: true }` (none of those buyers top up before confirming,
and that was never what those tests were about) — a comment at the top of
that file explains why, so a future session doesn't mistake it for
copy-paste noise. All 182 tests pass (18 new, 0 regressions). `npx tsc
--noEmit`, `npx eslint .` (only the two pre-existing, unrelated findings —
`passport/page.tsx`, `prisma/tests/db-constraints.test.ts` — confirmed
untouched), and `next build` all clean.

**Verified live**, full loop, both via `curl` cookie-jar sessions and the
real browser (not just unit tests) — `ethan@example.com` (buyer, seeded
balance 80) and `gabriel@greenpack.sg` (GreenPack supplier), listing 166
(Compostable Packaging Boxes, 18.50 cr/unit):
- Confirmed a 55.5 cr request within available balance → hold created,
  wallet showed `held: 55.5, available: 24.5`, no override log written.
- Confirming a second, 92.5 cr request against the now-24.5 available
  balance → clean `409 {requiresOverride:true, available:24.5,
  required:92.5}` — proves a hold from one request actually constrains a
  *different* request's confirm, the whole point of the feature (the raw
  ledger balance of 80 alone would have covered it).
- Same request, resubmitted with `override:true` → succeeded, hold placed
  anyway, `GET /api/activity?types=bulk_order_confirmed_despite_insufficient_credit`
  showed exactly one row with the correct available/required numbers in the
  description.
- Fulfilling the first request released its hold and debited the real
  ledger (balance 80 → 24.5); declining the second (now-confirmed) request
  released its hold with no refund (nothing was ever debited); a third
  request's cancellation-approval flow also confirmed to release its hold.
  Wallet correctly returned to `held: 0` after each release point.
- Browser verification hit the same "clicks don't register" issue noted
  informally before in this session (not a code bug — `computer` left_click
  wasn't triggering React's event handling for reasons unrelated to this
  feature); worked around by dispatching real `.click()` calls via the
  debugging JS tool once ref-based clicks also failed, which is how the
  gradient bug above was actually caught (screenshot showed the modal
  render, `getComputedStyle` showed the real problem).
- All scratch state (bulk order requests 13–16, their `CreditHold` rows, the
  one fulfillment `Transaction`, and 14 `ActivityLog` rows) deleted via a
  one-off script afterward; Ethan's wallet reconfirmed at `balance: 80,
  held: 0, available: 80` — DB back to seeded state.

**Not touched:** the credit-hold concept only applies to bulk orders, per
the original scope — bookings and "Buy Now" purchases still debit
immediately at creation/fulfillment with no hold step, unchanged. No changes
to `fulfillBulkOrderWithDebit`'s actual debit logic beyond adding the
release call.

## Write-Path Session — Stripe Booking Charges + Purchase/RewardGrant Rewiring (2026-07-21)

The session the two prior schema-only amendments (purchased/earned split,
2026-07-20; gigs + consumables earned-credits, 2026-07-21) were building
toward: booking creation now actually charges real-time SGD via Stripe, and
`Purchase.earnedCreditsApplied` is actually wired. Gigs stayed shelved per
explicit instruction, even though `GigTask`/`GigAssignment` already exist —
no gig payment logic was touched.

**Task 1 (inspect first) surfaced three findings that changed the session's
actual scope, reported to the product owner before writing any logic:**
- Zero Stripe SDK usage anywhere in this repo (confirmed by grep) — the old
  wallet top-up flow was always credits-only. This session installs `stripe`
  for the first time.
- The "`type: purchase` never created by real app code" gap the session
  brief described was already closed (Sprint 4.5's `createPurchaseWithDebit`
  — see that session's write-up). What was actually still open on the
  Purchase side was narrower: wiring the schema-only
  `Purchase.earnedCreditsApplied` into that existing debit path.
- No "reward system" (percentage/unit rules) exists anywhere in the schema
  or code — `earnedBalance` is just a live `Decimal` SUM off the ledger. The
  session brief asked for the server to "resolve what a reward is worth,"
  but there was nothing to resolve against. Flagged rather than invented.

**Design decisions, all confirmed with the product owner before writing
code:**
- **New `RewardGrant` model** (`userId`, `type` enum
  `booking_discount_pct`/`free_consumable_unit`/`gig_payout_credit`,
  `value`, `status` available/redeemed/expired, `grantedVia` free-text,
  `redeemedAt`) — a discount request references a specific, server-issued
  grant by id, never a client-supplied dollar amount or percentage.
  `earnedBalance` as a pooled SUM still exists for reporting but nothing
  redeems against it directly. New `Transaction.rewardGrantId` FK ties an
  `earned_spend` row back to the grant it spent. No issuance flow exists yet
  for any grant type — rows are seeded directly via Prisma, same as every
  other "schema now, write-path later" item in this codebase. Migration
  `20260720165211_reward_grants_and_booking_stripe` (the auto timestamp
  landed in UTC slightly behind the neighboring 2026-07-21 migration's
  filename — cosmetic only, no dependency between them, left as-is rather
  than risk desyncing `_prisma_migrations` tracking by renaming).
- **Stripe ordering:** the `PaymentIntent` is created *before* the DB
  transaction opens (confirmed with the product owner — Prisma's
  `$transaction` can't roll back an external API call). If the DB
  transaction then fails for any reason (double-booking race, lost
  grant-redemption race), `createBookingWithDebit` issues a compensating
  Stripe refund before rethrowing, so a charge never survives without a
  matching booking. A fully-discounted booking (grant clamps to 100%) skips
  the Stripe call entirely — Stripe rejects zero-amount PaymentIntents
  outright, caught live by the RewardGrant test suite before it could ship.
- **Server-side test tokens only, no checkout UI this session** — the API
  takes a `paymentMethodId` (Stripe's own static test tokens,
  `pm_card_visa`/`pm_card_chargeDeclined`, safe to reuse indefinitely in
  test mode); no Stripe Elements card-entry component was built. Real
  card-entry UI is explicit follow-up scope, not silently assumed done.
- **Purchases stay purchasedBalance-funded, not a Stripe charge per
  purchase** — unlike bookings, consumables are SpaceSnap's own stock, so
  the MAS compliance boundary that forces bookings onto real-time Stripe
  doesn't apply here. `createPurchaseWithDebit` switched from the old
  combined-ledger `purchase` type to `purchased_spend`, checked against a
  new `assertSufficientPurchasedBalance` (`lib/credits.ts`) instead of the
  blind combined `assertSufficientBalance`.
- **Stripe Connect (85/15 operator payouts) confirmed out of scope** — single
  charge from member to platform's own account only, per the product
  owner's explicit confirmation. Sprint 6's full scope, untouched.

**What was built:**
- `lib/stripe.ts` — Stripe client (`stripe` npm package, first use in this
  repo) + a `toStripeCents` helper (`Decimal` SGD → integer minor units).
- `lib/reward-grants.ts` — `resolveRewardGrantDiscount` (read-only sizing,
  called ahead of the Stripe call so the charge amount is known before the
  DB transaction opens; clamps the discount to the charge amount so a grant
  can never produce a net credit) and `redeemRewardGrant` (atomic
  `updateMany` status-flip inside the caller's transaction — the actual
  concurrency guard against double-redeeming the same grant).
- `lib/bookings.ts`: `createBookingWithDebit` rewritten — no longer checks
  or debits any wallet balance; charges `sgdAmount - earnedCreditsApplied`
  via a real Stripe PaymentIntent, writes a `booking_payment` Transaction
  (+ `earned_spend` if a grant was redeemed), same atomic `$transaction` as
  before for the Booking/Transaction/ActivityLog rows. New
  `StripeChargeFailedError`/re-exported `RewardGrantNotRedeemableError`.
  `declineBookingWithRefund`/`confirmBookingWithAudit` untouched — decline
  is a real, explicitly-flagged remaining gap (see sprint plan).
- `lib/purchases.ts`: `createPurchaseWithDebit` rewired to
  `purchased_spend`/`assertSufficientPurchasedBalance`, plus the same
  RewardGrant (`free_consumable_unit`) redemption pattern as bookings.
- `lib/wallet.ts`: `createTopUp` switched from `TransactionType.topup` to
  `purchased_topup` — **found live, not anticipated in planning**: with
  Purchase now checking `purchasedBalance` specifically instead of the
  blind combined sum, top-ups still writing the old un-partitioned `topup`
  type meant no top-up could ever fund a "Buy Now" purchase going forward.
  Fixed in the same session per this codebase's "known gaps get fixed at
  the point they're rebuilt" rule, not deferred. Doesn't backfill
  pre-existing seeded `topup` rows.
- `app/(user)/wallet/page.tsx`: **second live-verification catch** — the
  wallet-topup type change above broke this page's `isCreditType` helper,
  which hardcoded `type === "topup" || type === "refund"` to decide the
  +/− sign and to exclude credits from "This Month's Spend." A fresh
  top-up rendered as a debit and inflated the spend figure. Root-caused via
  live browser verification (screenshot alone looked fine, `get_page_text`
  caught the wrong sign), not caught by any test (no frontend test coverage
  for this page). Fixed by deriving credit/debit from the transaction's
  `amount` sign directly instead of a type allowlist — matches the ledger's
  own documented convention ("amount sign carries the direction," see
  `Transaction`'s schema comment) and can't go stale again as new
  `TransactionType` values are added.
- `components/BookingModal.tsx` / `lib/hooks/useListings.ts`: `Book Now`
  now sends a hardcoded `pm_card_visa` test token as `paymentMethodId`, with
  a `TODO(stripe-elements-checkout)` comment — keeps the live golden path
  working end-to-end pending a real card-entry UI, not a silent no-op.
- Schema: `RewardGrant`/`RewardGrantType`/`RewardGrantStatus`,
  `Transaction.rewardGrantId`, dated comments on `Booking`/`Purchase`
  documenting the closed gap. `.env`/`.env.testing`/`.env.example` gained
  `STRIPE_SECRET_KEY` (a real Stripe test-mode sandbox key in the two
  gitignored env files, a placeholder in `.env.example`).

**A third live-only bug, found and fixed before any of the above could be
verified at all:** `createBookingWithDebit` originally passed
`customer: user.stripeCustomerId` to the PaymentIntent create call. Every
seeded user's `stripeCustomerId` (e.g. `cus_test_ethan001`,
`prisma/seed.ts`) is a placeholder string, not a real Stripe Customer object
— passing it made every live Stripe call fail with "No such customer,"
invisible to the unit test suite because test fixtures never set
`stripeCustomerId` at all (so the field was already `null`/`undefined`
there, masking the bug). Fixed by not attaching a Customer at all — a
one-off charge against a supplied PaymentMethod doesn't need one; real
Stripe Customer creation/lookup is its own unbuilt feature. Caught only by
driving the actual browser flow against the real Stripe sandbox, not by
`npm test` or `tsc`/`eslint`/`next build` alone — all three passed the whole
time this bug was live.

**Tests:** `lib/bookings.test.ts`'s `createBookingWithDebit` coverage fully
rewritten (real Stripe test-mode API calls, no mocking, same "hit the real
backing service" convention as this file's existing Postgres coverage) —
full-cost charge + `booking_payment` row, `pm_card_chargeDeclined` rejection
via `StripeChargeFailedError`, a genuine double-booking race against the DB
exclusion constraint proving the compensating-refund path actually fires,
plus 5 new RewardGrant redemption cases (percentage discount, already-
redeemed, wrong owner, wrong type, 100%-clamp skipping Stripe entirely).
`lib/purchases.test.ts` similarly rewritten for `purchasedBalance`
fixtures + 5 new RewardGrant (`free_consumable_unit`) cases.
`lib/wallet.test.ts` updated for `purchased_topup`. All 192 tests pass (0
regressions), `npx tsc --noEmit`, `npx eslint .` (same two pre-existing,
unrelated findings as every prior session), and `npx next build` all clean.

**Verified live**, full loop via the real browser against the real Stripe
test sandbox (not just unit tests) — `ethan@example.com`, Studio Space A
(120 cr/day) and Compostable Packaging Boxes (18.50 cr/unit):
- Booked Studio Space A for Jul 25 → `201`, `Booking.sgdAmount` 120,
  exactly one `booking_payment` Transaction (`-120`,
  `stripePaymentIntentId` set) — cross-checked directly against the Stripe
  API (`paymentIntents.retrieve`): `status: succeeded, amount: 12000,
  currency: sgd`, confirming the DB row and the actual Stripe charge agree.
- "Buy Now" on the packaging listing failed first with "Insufficient credit
  balance" — correct, expected behavior: Ethan's existing 80 cr was all
  legacy `topup` rows, and `purchasedBalance` (the new `purchased_topup`/
  `purchased_spend`-only sum) was genuinely zero. Topped up 50 credits via
  the real Top Up Credits UI (which is what surfaced the wallet-topup and
  wallet-page bugs above), then "Buy Now" succeeded — "Purchase Complete...
  18.5 credits were charged."
- All scratch state (the test booking + its Transaction, the test purchase +
  its Transaction + stock restored, the test top-up Transaction + its
  ActivityLog row) deleted via one-off scripts afterward; re-confirmed via
  the DB directly, not just the UI.

**Not touched, explicitly deferred, not silently dropped:**
- Booking decline still uses the old combined-ledger `refund` credit, not a
  real Stripe refund + `earned_grant` reversal — flagged as a new standalone
  gap in `SPRINT_PLAN_NEXTJS_REWRITE.md` rather than assumed covered by this
  session's refund-on-DB-failure logic (that logic only fires for the
  *creation*-time compensating case, not a supplier's later decline).
- No RewardGrant issuance flow of any kind (admin/promo UI, referrals, gig
  payouts) — grants are only reachable today by seeding them directly.
  Flagged as its own new known gap in the sprint plan.
- Gigs: confirmed still shelved per this session's explicit scoping
  instruction, despite `GigTask`/`GigAssignment` already existing in schema.
- Stripe Connect / operator payout splits: confirmed out of scope with the
  product owner, Sprint 6's full remit.
- No Stripe Elements checkout UI — `BookingModal` sends a hardcoded test
  token; a real card-entry flow is unbuilt follow-up work, not assumed done.

## Schema + Core Lib — Merchant-of-Record Cancellation Model (2026-07-21)

Task brief asked for schema + pure-function logic backing a "merchant-of-
record, direct-charge" booking payment model, explicitly framed as replacing
"the Stripe-Connect-split assumption in the current Sprint 6 plan," with a
list of "confirmed facts" to check the schema against before writing
anything (same discipline as every prior session in this file).

**The brief's own "confirmed facts" were stale — checked against
`prisma/schema.prisma` and `lib/bookings.ts` before touching anything, per
the brief's own instruction, and this is exactly the kind of thing that
instruction exists to catch:**
- The brief stated `Booking` "currently has no `sgdAmount`, no Stripe charge
  reference, no cancellation fields." **`sgdAmount` already exists** (added
  in the 2026-07-20 purchased/earned split) and **`Transaction` already has
  `stripePaymentIntentId`** (added in the very next session, "Write-Path
  Session — Stripe Booking Charges..." immediately above this entry, same
  day as this session per the system clock but a separate sitting). Only the
  cancellation fields were genuinely missing.
- The brief stated `createBookingWithDebit` "currently debits
  `getCreditBalance`" — **this is no longer true.** That same immediately-
  prior session already rewired it to charge a real Stripe PaymentIntent
  directly (merchant-of-record, direct-charge — exactly the target model
  this session's brief describes as new). It was not touched again here; a
  short note was added to its header pointing this out explicitly so a
  future session doesn't assume it still needs the rewrite this brief
  described. `declineBookingWithRefund`, by contrast, genuinely still uses
  the old combined-ledger `refund` Transaction with no real Stripe refund and
  no cancellation-window policy applied — that one got the TODO comment the
  brief asked for.
- Reused `Transaction.stripePaymentIntentId` for the direct charge's payment
  intent id, per the brief's own instruction not to add a duplicate column —
  confirmed no second column was needed since the field already existed and
  is already populated by `createBookingWithDebit`.

**What was built (schema + pure functions only, no Stripe calls, no route
changes, no UI, per the brief's explicit exclusions):**
- `Booking` gained `cancelledAt`, `cancelledBy` (new `BookingCancelledBy`
  enum: `user`/`supplier`), `cancellationReason`, `userRefundPercent`
  (`Decimal(5,2)`, nullable), `supplierPenaltyPercent` (`Decimal(5,2)`,
  nullable). Not added: `sgdAmount`/`stripePaymentIntentId` (already
  covered, see above).
- New `BookingCredit` model/table — a bounded, per-booking credit note
  (`userId`, `sourceBookingId`, `amount`, `status` new `BookingCreditStatus`
  enum `available`/`applied`/`expired`, `appliedToBookingId` nullable,
  `expiresAt`, `createdAt`). Two separate FK relations to `Booking`
  (`BookingCreditSource`/`BookingCreditAppliedTo`, disambiguated relation
  names since both point at the same model). Deliberately kept out of
  `getPurchasedBalance`/`getEarnedBalance` (`lib/credits.ts`) — it's not a
  wallet top-up and must not be merged into that balance calculation, per
  the brief's explicit instruction.
- New `SupplierPayable` model/table — what SpaceSnap owes a supplier per
  booking under the merchant-of-record model (`companyId`, `bookingId`
  unique/one-to-one, `grossAmount`, `penaltyDeduction` default 0,
  `netAmount`, `status` new `SupplierPayableStatus` enum
  `pending`/`invoiced`/`paid`, `invoicingCadence` new `InvoicingCadence`
  enum `monthly`/`biweekly`/`weekly`, `createdAt`). `invoicingCadence` is a
  snapshot at creation time, not a live join to `Company.supplierTier` — a
  mid-cycle tier change must never reshuffle an already-pending/invoiced
  payable. Which cadence each tier actually maps to is not decided this
  session (no such mapping exists anywhere to check against) — the column
  just holds whatever a future write-path session resolves.
- `Company.supplierTier` — new `SupplierTier` enum (`free`/`preferred`/`top`,
  default `free`). No automatic gating logic (rating/availability/booking-
  count thresholds) was built, per the brief's explicit instruction — those
  numbers are still TBC, same posture as every other "numbers TBC, don't
  invent" gap already flagged elsewhere in this file/sprint plan.
- Migration `20260721053114_booking_cancellation_credits_supplier_payables`,
  applied cleanly to both `spacesnap_dev` and the isolated
  `spacesnap_nextjs_test` DB (`npm run test:db:migrate`).
- `lib/booking-payments.ts` — `calculateUserCancellationRefund(booking,
  cancelledAt)` and `calculateSupplierCancellationPenalty(booking,
  cancelledAt)`, pure/no-DB (same "unit-testable without a DB" pattern as
  `lib/certificate-gating.ts`). Both compute a calendar-day count between
  `cancelledAt` and `booking.startDate` (both normalized to UTC midnight
  before diffing, so the cancellation timestamp's time-of-day can't shift
  which tier a same-calendar-day cancellation lands in) and return a percent
  tier: `>=7 days before` → 100 refund / 0 penalty, `3-6 days before` → 50 /
  50, `<3 days before (incl. after start)` → 0 / 100.

**Flagged, not silently guessed — genuinely open questions for the product
owner before this is wired into a real route:**
- **The exact cancellation-window day thresholds (7/3/0) and percentages
  (100/50/0) are this session's own inference from the brief's own named
  boundary-day test cases ("day 7, day 3, day 0"), not a policy confirmed
  anywhere else** — grepped this codebase and the old Laravel repo for any
  existing cancellation-window concept, zero hits. This is exactly the kind
  of assumption this file's Sprint 4 "tier comparison scrapped" entry warns
  against making permanent without confirming — flagging it here explicitly
  so it doesn't quietly become load-bearing policy. Confirm with the
  product owner before any future session calls these functions from a real
  cancellation endpoint.
- `calculateSupplierCancellationPenalty` returns only the percent tier, not
  a dollar amount — it's meant to apply "against SpaceSnap's commission
  portion of the booking, not the full booking value" per the brief, but
  **no commission-rate figure exists anywhere in this schema** (grepped;
  `SPRINT_PLAN_NEXTJS_REWRITE.md`'s Sprint 6 section already says "platform
  fee / operator payout mechanics... scope TBD"). Resolving the percent
  against an actual commission amount is left to whichever future session
  builds `SupplierPayable`'s write path.
- **Ambiguity in the brief itself, resolved by not building it:** point 4 of
  the schema-changes list said to "stub the admin route with a TODO comment"
  for `Company.supplierTier`, while the brief's title and "EXPLICIT
  EXCLUSIONS" section both said "no routes... this session" (scoped
  specifically to `app/api/bookings/**`, but the overall framing was
  "schema and pure-function logic only"). No new route file was created —
  the "stub with a TODO" instruction is satisfied by this write-up and the
  schema comment on `SupplierTier` instead, on the read that "no routes this
  session" was the dominant, repeated instruction. Flagging this
  interpretation explicitly in case it's wrong — a future session may still
  need to add `PATCH /api/admin/companies/[id]/supplier-tier` (or similar)
  as a small, separate, manually-triggered admin action.
- Which `InvoicingCadence` each `SupplierTier` maps to is undecided (see
  above) — not guessed at.

**Tests:** `lib/booking-payments.test.ts` (new, registered in `package.json`
alongside the existing suite) — 17 cases: exact boundary days (7, 3, 0) for
both functions, the tiers just inside each boundary (6, 2 days) to catch an
off-by-one specifically, cancelling after the session already started,
time-of-day robustness on the cancellation timestamp (11:59pm and 12:01am
variants of the same calendar day both land in the same tier), a `Date`-
object `startDate` accepted alongside a string, and a symmetry check that
the two functions' percentages always sum to 100 at every boundary. All 17
pass; full `npm test` — 209/209 (17 new, 0 regressions).

**Verified:** migration applied cleanly to both `spacesnap_dev` and
`spacesnap_nextjs_test` (`npx prisma migrate dev` / `npm run
test:db:migrate`), `npx tsc --noEmit` clean, `npx next build` clean, `npx
eslint .` shows the same two pre-existing findings as every prior session
(`app/(user)/passport/page.tsx`'s `setState`-in-effect,
`prisma/tests/db-constraints.test.ts`'s one `any`) — neither touched this
session, not introduced by it.

**Not built, per the brief's explicit exclusions:** no Stripe API calls
(payment intent creation/capture/refund for cancellation), no route changes
to `app/api/bookings/**` (or anywhere else), no UI, no automatic
supplier-tier gating logic, no changes to `purchasedBalance`/`earnedBalance`
consumables/cert-fee logic, `createBookingWithDebit`/
`declineBookingWithRefund` left in place (the former already correct for
this model, the latter TODO'd, neither deleted/rewritten).

## Cancellation Route + Commission-Rate Closure (2026-07-21)

Closed two of the three still-open Sprint 6 follow-ons from the schema
session above: the commission-rate figure, and the cancellation route +
real Stripe refund execution. Both numbers (10% commission for
space/equipment bookings; the free/preferred/top → monthly/biweekly/weekly
invoicing-cadence mapping) were confirmed directly with the product owner
before writing any code, per this project's "don't guess a number, ask"
convention.

### Correction to already-shipped code, not just an addition

Before writing the cancellation route, the product owner walked through the
actual mechanics with a concrete example (100-credit booking, supplier
cancels 3 days out → 50% of the 10-credit commission = 5-credit penalty,
deducted from the supplier's holding sum or invoiced if it can't cover it).
That clarified something `declineBookingWithRefund` (built in the prior
schema session) had wrong: **whichever party did NOT cause the cancellation
is made whole — the day-based tier only ever governs the at-fault party's
own side, never both at once.** The shipped version applied the day tier to
the user's refund on every decline, regardless of who caused it — meaning a
supplier declining late would have left the user with a reduced refund for
something that wasn't their fault. Confirmed explicitly with the product
owner before touching the shipped function (see the chat transcript this
session started from) — this is the same "state a read, don't silently
guess, and don't silently leave a wrong assumption in place once corrected"
posture as the Sprint 4 tier-comparison scrap.

**Corrected design, both sides now built:**
- **Supplier-initiated (decline, rewritten):** user is always refunded
  100% — the day tier no longer touches their refund. The day tier
  (`calculateSupplierCancellationPenalty`, unchanged function) now sizes the
  supplier's penalty against `Booking.platformCommissionPercent` of
  `sgdAmount` (not the full booking value), which resolves into a real
  `SupplierPayable` row — closing the "penaltyDeduction needs a real
  commission-rate figure" TODO left by the prior session. `netAmount` can go
  negative (supplier owes SpaceSnap back) if the penalty exceeds their gross
  payout — no automated invoicing/collection beyond this ledger row is
  built, per the still-open Sprint 6 Invoice/Receipt gap.
- **User-initiated (cancel, new):** `cancelBookingWithRefund` (`lib/bookings.ts`),
  `PATCH /api/bookings/[id]/cancel`. The day tier
  (`calculateUserCancellationRefund`, unchanged function) sizes the user's
  own refund, same as originally designed. The supplier is never penalized —
  `SupplierPayable.penaltyDeduction` is always 0, full normal payout,
  because the cancellation wasn't their doing.

Both functions otherwise mirror each other's structure exactly (Stripe
refund before the status-guarded DB write, same narrow race accepted, same
earned-credit-reversal-as-ledger-only-`earned_grant` idiom, same
`SupplierPayable` write) — only the refund/penalty math, `cancelledBy`, and
which party's ownership gets checked at the route layer differ. The route
layer follows the existing decline route's own pattern: ownership is
checked in the route (booking's `userId` vs. the session), not the lib
function — same split the supplier decline route already used for
company-ownership.

### Schema

Migration `20260721071416_booking_cancellation_commission_and_cancel_activity`:
`Booking.platformCommissionPercent` (Decimal 5,2, default 10.00 — the
default matters here since existing seeded/dev bookings backfill to the
confirmed 10% rather than needing a data migration), and
`ActivityActionType.booking_cancelled` (distinct from `booking_declined`,
matching this schema's existing "one value per hooked action" convention).
Applied to both `spacesnap_dev` and `spacesnap_nextjs_test`.

`lib/booking-payments.ts` gained `PLATFORM_COMMISSION_PERCENT_BOOKINGS`
(the confirmed flat 10%, snapshotted onto `Booking.platformCommissionPercent`
at creation in `createBookingWithDebit` rather than read live at
cancellation time — same "don't let a later rate change reshuffle an
existing booking" principle `SupplierPayable.invoicingCadence` already
established) and `invoicingCadenceForSupplierTier` (the confirmed
free/preferred/top → monthly/biweekly/weekly mapping, snapshotted onto
`SupplierPayable.invoicingCadence` at the moment each payable is created).
The file's header comment was rewritten to describe the corrected
at-fault-party design instead of the original (now-resolved) "not confirmed
with the product owner" flag.

### Tests

`lib/bookings.test.ts`: the existing day-tier decline tests were rewritten
(they previously asserted a tiered user refund on decline, which is now
wrong) to assert 100%-user-refund-always plus the correct `SupplierPayable`
math (gross/penalty/net) at each of the three day tiers, plus a test
confirming an earned-credit discount is reversed in full on decline
regardless of timing. A new parallel describe block covers
`cancelBookingWithRefund` at all three day tiers, the earned-credit
proportional reversal, double-cancel rejection, and already-cancelled
rejection — mirroring the existing decline test structure. Full suite: 219
tests, all passing (`npm test` against the isolated `spacesnap_nextjs_test`
DB). `npx tsc --noEmit`, `npx eslint .` (same two pre-existing findings as
every prior session, neither touched here), and `npx next build` all clean.

### Verified live, not just unit-tested

Real cookie-jar logins against the dev server/DB (`ethan@example.com`,
`divya@toolshare.sg` — ToolShare SG supplier, `farah@example.com`), listing
165 (Power Drill Set, no cert requirement, priceDay 25.00, ToolShare SG =
`free` supplierTier):
- **Cancel, ≥7 days out** (booking 160): `PATCH /api/bookings/160/cancel` as
  `ethan` → `200`, `cancelled_by='user'`, `user_refund_percent=100`,
  `supplier_penalty_percent=0`; one `refund` Transaction for the full
  25 SGD; `supplier_payables` row: gross 22.50 (25 − 10% commission),
  penalty 0, net 22.50, `invoicing_cadence='monthly'`.
- **Decline, 3-6 days out** (booking 161): `PATCH
  /api/supplier/bookings/161/decline` as `divya` → `200`,
  `cancelled_by='supplier'`, `user_refund_percent=100` (not tiered — the
  correction in effect), `supplier_penalty_percent=50`; refund Transaction
  for the full 25 SGD; `supplier_payables` row: gross 22.50, penalty 1.25
  (50% of the 2.50 commission), net 21.25.
- **Guards**: `farah` (not the booking's owner) attempting to cancel
  ethan's booking → `403`; re-cancelling an already-cancelled booking →
  `422 {"message":"Booking is already cancelled and cannot be cancelled."}`;
  unauthenticated cancel attempt → `401`.
- All test bookings (160, 161) and their Transaction/SupplierPayable rows
  deleted afterward; dev DB confirmed back to its seeded state (both
  counts `0`).

**Note:** the dev server needed a restart mid-session — `npx prisma
generate` regenerates the client files on disk, but the already-running
Next dev process had the old client module cached in memory and threw
`PrismaClientValidationError: Unknown argument platformCommissionPercent`
on the first live booking-create attempt until restarted. Not a code bug,
just a dev-server-lifecycle gotcha worth remembering for the next schema
change made mid-session.

**Not touched, per this session's actual scope:** the `BookingCredit`
issuance policy (still undecided — see Sprint 6's own open item), any
UI (`BookingModal.tsx`, a "Cancel Booking" button — Sprint 4.75 flagged
this as unblocked by this route, but this session was scoped to the backend
route + refund only), the Stripe Elements real-card-entry item (next up,
per the product owner's own sequencing this session).

## SupplierPayable Correction — Completion Earnings + Live Aggregate Balance (2026-07-21)

The previous session's `SupplierPayable` writes had a real bug, caught by
the product owner walking through a concrete worked example before any
penalty-deduction logic could be trusted: a $5 booking cancelled by the
supplier at the <3-day tier owes SpaceSnap a $0.50 penalty (10% commission
× 100% tier), recovered from whatever the supplier is already holding from
*other* completed bookings — not from the cancelled booking itself, which
earned nothing (the full $5 was refunded to the user).

**The bug:** both `declineBookingWithRefund` and `cancelBookingWithRefund`
computed `grossAmount = sgdAmount - commission` for the *cancelled* booking
itself, fabricating a payout for a booking whose service was never
rendered. Worse, **nothing in the codebase created a `SupplierPayable` row
for a normal, non-cancelled completed booking at all** — the model only
ever got exercised by the cancellation paths added last session, so the
"supplier earned $9 from two completed bookings" half of the product
owner's own example had no code path to produce it.

**Fix, both halves:**
- New `lib/supplier-payables.ts`: `createCompletedBookingPayable(tx,
  bookingId)` — writes the actual earning row (`grossAmount = sgdAmount -
  commission`, `penaltyDeduction 0`, `netAmount = grossAmount`) once a
  booking's service is actually rendered. Wired into `checkOutCheckIn`
  (`lib/check-ins.ts`), right after the existing `active -> completed`
  transition, only when the check-in is booking-linked. `
  getSupplierPendingPayableBalance(companyId)` — the live `SUM(netAmount)`
  over a company's `pending` `SupplierPayable` rows, same
  never-stored-denormalized principle as `getCreditBalance`
  (`lib/credits.ts`). This is what actually answers the product owner's
  question ("does SpaceSnap automatically deduct the penalty from what the
  supplier is holding") — there's no explicit "check balance, then deduct"
  branch anywhere; a penalty debit row and completion credit rows for the
  same company just net together in this one live SUM, the same way a
  Transaction ledger SUM already absorbs a spend against a prior top-up.
  The SUM can go negative (supplier owes SpaceSnap back) when penalties
  exceed pending earnings — recovering that is a still-unbuilt
  invoicing/collection step (Sprint 6 Invoice/Receipt gap, unchanged).
- `declineBookingWithRefund` corrected: the cancelled booking's own
  `SupplierPayable` row is now a pure penalty **debit** —
  `grossAmount 0`, `penaltyDeduction` = the day-tier percent of the
  commission, `netAmount = -penaltyDeduction`. No fabricated gross for a
  refunded booking.
- `cancelBookingWithRefund` corrected: still writes a `SupplierPayable` row
  for audit-trail consistency (every terminal booking gets exactly one row,
  whether from completion, decline, or cancel), but now all-zero
  (`grossAmount 0`, `penaltyDeduction 0`, `netAmount 0`) — a user-initiated
  cancellation is a zero-effect event for the supplier ledger, not a
  fabricated full payout.
- `prisma/schema.prisma`'s `SupplierPayable` comment rewritten to document
  the three actual row shapes (completion credit / decline-penalty debit /
  zero-effect audit row) and the live-SUM aggregate principle, replacing
  the old (incorrect) "one row per booking always has a real gross/penalty
  split" description.

**Tests:** `lib/bookings.test.ts`'s existing decline/cancel `SupplierPayable`
assertions rewritten for the corrected math at all three day tiers.
`lib/check-ins.test.ts` gained assertions that `checkOutCheckIn` now writes
the completion payable (and that a bare, non-booking check-out writes
none). New `lib/supplier-payables.test.ts` (registered in `package.json`):
`getSupplierPendingPayableBalance` returns zero with no rows, only sums
`pending`-status rows (an `invoiced` row manually created to prove the
filter), a worked-example test reproducing the product owner's own numbers
exactly (2× $5 completed bookings + 1× $5 booking declined <3 days out →
$8.50 pending, matching `$9 earned - $0.50 penalty`), and a negative-balance
test (penalty exceeding pending earnings drives the SUM below zero rather
than clamping at zero). Full suite: 224 tests, all passing. `npx tsc
--noEmit`, `npx eslint .` (same two pre-existing findings, untouched), and
`npx next build` all clean.

**Verified live**, not just unit-tested — real cookie-jar logins against
the dev server/DB (`ethan@example.com`, `divya@toolshare.sg`), listing 165
(Power Drill Set, ToolShare SG, priceDay 25.00, `free` supplierTier):
booking 162 created → confirmed → checked in → checked out (via the real
`/api/check-ins` + `/api/check-ins/[id]/check-out` routes) produced a
`SupplierPayable` of gross 22.50 / penalty 0 / net 22.50. Booking 163
(1 day out) created → confirmed → declined by `divya` produced gross 0 /
penalty 2.50 (100% of the 2.50 commission) / net -2.50. Direct SQL
`SUM(net_amount) WHERE company_id=123 AND status='pending'` = **20.00**,
confirming the aggregate nets a completion credit against a penalty debit
exactly as designed, through the real routes rather than only in-process
test helpers. All test bookings, check-ins, transactions, activity-log
rows, and payables deleted afterward; dev DB row counts confirmed back to
seeded state.

**Not touched:** any UI/route exposing a supplier's payable balance (the
supplier profile's "Accounts Receivable" card is still explicitly
out-of-scope, blocked on the Sprint 6 Invoice/Receipt gap — this session
only fixed the underlying ledger correctness), and the no-show/never-
checked-out gap already flagged in the Sprint 3.5 `check_ins` schema note
(a `confirmed` booking that's never checked in still never transitions or
gets a payable — unchanged, undecided territory).

## Sprint 4.75 — Modify Booking (Reschedule) Backend (2026-07-21)

New feature, added to Sprint 4.75 at the product owner's request, per a
detailed pseudocode spec covering two engines:
- **Step A, Modification Request Engine**: when a user reschedules a
  booking, notice (days between the booking's CURRENT start date and today)
  determines eligibility/fee — `> 7` days: free, `max_refundable_percent`
  reset to 100%; `3-7` days: 20% modification fee charged immediately,
  `is_modified = true`, `max_refundable_percent` reset to 50%; `< 3` days:
  rejected outright (fulfil or cancel instead).
- **Step B, Cancellation Refund Cap Engine**: a later cancellation's
  standard day-tier refund is capped at `min(standard refund,
  max_refundable_percent)` — so a booking that used its cheap reschedule
  window can't then cancel for a bigger refund than the modification's own
  tier allowed.

Read the existing cancellation-window code (`lib/booking-payments.ts`,
`lib/bookings.ts`'s `cancelBookingWithRefund`/`declineBookingWithRefund`)
before writing anything, since this is explicitly designed to compose with
it, not replace it — confirmed the existing at-fault-party model (supplier
decline always refunds the user 100%, only user-initiated cancel follows a
day tier) before deciding where the cap plugs in.

### Build-time decisions, flagged rather than guessed (not confirmed with
the product owner this session — the brief was pseudocode, not a full
spec):

- **"booking_fee" = `Booking.sgdAmount`** (the full nominal price
  snapshotted at creation), not the net Stripe-charged amount after any
  earned-credit discount. The modification fee is a flat cost of rescheduling
  THIS booking, not scaled by how it happened to be paid for.
- **Duration-preserving reschedule.** The brief only ever says "new
  requested date" (singular) — read as shifting the whole
  `startDate..endDate` window by the same offset, so a 3-day booking stays a
  3-day booking. The client sends `newStartDate` only; `newEndDate` is
  computed server-side from the existing duration. This avoids requiring the
  client to re-derive/re-validate a duration or re-quote a price for a
  different-length stay.
- **The Refund Cap Engine applies to `cancelBookingWithRefund` (user-
  initiated) only, NOT `declineBookingWithRefund` (supplier-initiated).**
  This codebase's existing at-fault-party design makes the user whole when
  the SUPPLIER cancels, regardless of cause — capping that refund because
  the user separately chose to reschedule earlier would penalize the user
  for something the supplier caused, contradicting a design this codebase
  already settled on with the product owner (see `declineBookingWithRefund`'s
  own header comment, 2026-07-21 correction). Worth a real confirmation with
  the product owner if this ever comes up, but the alternative (capping a
  supplier-caused refund) seemed clearly wrong to build silently.
- **`is_modified` is set true only the first time a modification lands in
  the fee tier** — matches the brief's own pseudocode exactly (the free-tier
  action list never mentions it). Never reset back to false by a later free
  modification. `max_refundable_percent`, by contrast, IS reset on every
  modification including a free one (brief: "Set to 1.00") — these two
  fields deliberately don't move in lockstep.
- **The 20% fee is real Stripe money movement**, not a ledger-only line —
  matches this codebase's standing discipline (Transaction ledger backs
  every credit-affecting action) and gives the fee its own new
  `TransactionType.booking_modification_fee` value rather than overloading
  `booking_payment` (same reasoning `gig_payout_sgd` used for its own new
  value: a genuinely distinct ledger event, not a duplicate of an existing
  one). Charged before the DB transaction opens (Prisma's `$transaction`
  can't roll back an external API call), with the same pre-charge /
  compensating-refund-on-failure discipline `createBookingWithDebit` already
  uses. Deliberately non-refundable if the booking is later
  cancelled/declined — no code path reverses a
  `booking_modification_fee` Transaction, since the fee is for the act of
  rescheduling, not part of the stay's own price.

### What was built

- `calculateModificationTerms` + `applyRefundCap`
  (`lib/booking-payments.ts`) — pure, no-DB calculators, same pattern as the
  existing cancellation-window functions. Covered a boundary subtlety
  explicitly: the modification free tier's day-7 boundary is `> 7` (exclusive),
  the OPPOSITE inclusivity from the cancellation tiers' `>= 7` (inclusive) —
  day 7 exactly lands in the 20% fee tier for a modification but the 100%
  tier for a cancellation. This is per the brief's own stated boundaries,
  not a copy-paste of the cancellation logic; a dedicated test asserts this
  so a future session doesn't "fix" it to match cancellation by mistake.
- Schema (migration `20260721075948_booking_modification_fields`):
  `Booking.originalStartDate` (nullable, set once on first modification,
  preserves the pre-modification date for history even across repeat
  reschedules — `startDate`/`endDate` always stay the CURRENT schedule,
  unchanged reading for every other part of this codebase), `isModified`
  (default false), `maxRefundablePercent` (nullable Decimal(5,2), null =
  uncapped/unaffected). New enum values: `ActivityActionType.booking_modified`,
  `TransactionType.booking_modification_fee`.
- `modifyBookingWithFee` (`lib/bookings.ts`) — the write path: status guard
  (only `pending`/`confirmed`), eligibility check, duration-preserving new
  date range, overlap pre-check via `hasOverlappingBooking` (extended with an
  optional `excludeBookingId` param so a booking being rescheduled doesn't
  collide with its own current row), fee charge via Stripe when applicable,
  one DB transaction updating the Booking + writing the fee Transaction (if
  any) + an ActivityLog row, with the same charge-before-transaction /
  compensating-refund-on-DB-failure discipline `createBookingWithDebit`
  uses. `parseModifyBookingFields` mirrors `parseBookingCreateFields`'s
  validate-then-throw shape (`newStartDate` required and not in the past,
  `paymentMethodId` optional at parse time — whether it's actually required
  depends on the fee tier, which parsing alone can't know).
- `cancelBookingWithRefund` now runs its standard day-tier refund through
  `applyRefundCap` against the booking's own `maxRefundablePercent` before
  writing it — one-line change, `null` (never-modified) is a no-op so every
  pre-existing booking/test is unaffected.
- `PATCH /api/bookings/[id]/modify` (`app/api/bookings/[id]/modify/route.ts`)
  — same ownership-check shape as the existing cancel route, translates each
  new error type to a clean HTTP status (422 not-modifiable/not-eligible/
  payment-method-required, 409 overlap including the 23P01 race-window
  fallback mirroring the create-booking route's own translation, 402 Stripe
  failure).

### Tests

`lib/booking-payments.test.ts`: 11 new cases (`calculateModificationTerms`'
day-7/day-3 boundaries including the inclusivity-flip vs. cancellation
noted above, `applyRefundCap`'s null/below/above/equal/zero cases).
`lib/bookings.test.ts`: 9 new cases against the real dev Postgres + Stripe
test-mode sandbox (no mocking, same convention as every other test in this
file) — free-tier modification (date updates, `originalStartDate` set,
`isModified` stays false), fee-tier rejected without a `paymentMethodId`
then succeeding with one (exact 20% charge, `isModified` true, cap 50),
too-soon rejection with no partial state, overlap rejection against another
booking, self-exclusion from the overlap check (modifying to the same date
it already holds doesn't self-collide), rejecting a modify on an
already-cancelled booking, and two Refund-Cap-Engine integration tests
(a modified booking's later cancellation is capped even with 7+ days notice
on its NEW date; a never-modified booking is unaffected). `npm test`:
244/244 passing, no regressions. `npx tsc --noEmit` and `npx eslint .` both
clean (the only two pre-existing lint findings, in `passport/page.tsx` and
`prisma/tests/db-constraints.test.ts`, are untouched by this session — confirmed via `git diff --stat` before treating them as pre-existing). `npx next build` succeeds, `/api/bookings/[id]/modify` listed in the route
manifest.

### Live verification (real dev server, real cookie-jar login, cleaned up after)

Hit a real bug during this pass, not just confirmed the happy path: the
already-running dev server (Turbopack) had an in-memory Prisma Client
generated BEFORE this session's `prisma generate` ran, so its first request
against the new `originalStartDate` field 500'd with `PrismaClientValidationError:
Unknown argument`. Root cause was a stale server process, not the
migration/schema — restarted the dev server (`preview_stop` + `preview_start`)
and the identical request succeeded immediately after. Confirmed booking 164
(the request that hit the stale-client 500) rolled back cleanly with no
orphan state before retrying — the free tier's zero-Stripe-charge path means
there was nothing to compensate-refund either way. **Flagging this as a
real deploy-order note**: a Railway deploy that runs `prisma migrate deploy`
without also restarting/rebuilding the Next.js process will hit this same
class of error in production.

As `ethan@example.com` against listing 165 (Power Drill Set, no cert
requirement, $25/day) on the seeded dev DB:
- Booking #164 created 10 days out → modified to 25 days out (free tier) →
  `originalStartDate: "2026-07-31"`, `maxRefundablePercent: 100`,
  `isModified: false`. Matches the free-tier spec exactly.
- Booking #165 created 5 days out (fee tier) → modify attempt without
  `paymentMethodId` → clean 422 `{"paymentMethodId": ["A payment method is
  required..."]}}`, nothing charged. Retried with `pm_card_visa` → 200,
  `isModified: true`, `maxRefundablePercent: 50`, and the wallet transaction
  feed confirmed an exact `-5` SGD `booking_modification_fee` row (20% of the
  25.00 `sgdAmount`) with a real `stripePaymentIntentId`.
- Booking #165 then cancelled (40 days from its new date — a 100% standard
  refund tier) → actual refund was `12.5` SGD (50%), confirmed via both the
  API response's `maxRefundablePercent: 50` and the wallet feed's refund
  Transaction row — the Refund Cap Engine correctly overrode the day-tier's
  100% down to the modification's 50% cap.
- Booking #166 created 1 day out → modify attempt → clean 422 "starts too
  soon to be modified," no booking/transaction/activity rows written.
- All 3 test bookings + their 5 Transaction rows + 6 ActivityLog rows
  deleted afterward by explicit id (via a scratch Prisma script, deleted
  immediately after running, not committed) — re-confirmed the dev DB's
  `bookings`/`transactions` counts matched their pre-verification values.

### Not built this session (flagged, not silently dropped)

- **Frontend UI.** No "Modify Booking" control exists anywhere in the app —
  this session was backend-only, per the same "backend first" pattern the
  Sprint 6 cancellation route followed before its own (still-unbuilt) UI.
  Sprint plan updated to note this explicitly rather than implying the
  feature is user-reachable.
- **Re-running cert-gating or availability checks beyond the overlap
  check** at modify time — a credential could theoretically expire between
  the old and new dates; not handled, not asked for, flagged here as a real
  but narrow gap rather than guessed at.
- **`declineBookingWithRefund` does not consult `maxRefundablePercent`** —
  deliberate, see the at-fault-party reasoning above, not an oversight.

## Sprint 4.75 — Cancel/Modify Booking UI + Stripe Elements Card Entry (2026-07-21)

Frontend session closing the two UI gaps the product owner picked from the
"what's next" list: the Cancel/Modify Booking controls (both backends landed
earlier this same day / the day before, both flagged "no UI exists") and the
Stripe Elements card-entry item ("buildable now, not blocked").

### Entry point decision (made here, not specced anywhere)

No design ever specced where Cancel/Modify surface. Went with a new
**"My Bookings" card on the user dashboard** (`app/(user)/user/page.tsx`),
directly mirroring the existing Bulk Orders card's row-with-inline-actions
anatomy — one row per booking, status badge, Cancel/Modify text buttons on
`pending`/`confirmed` rows only (matching the lib-layer status guards), and a
"Rescheduled from {date}" hint when `originalStartDate` is set. Flagging the
placement as this session's own call, easily moved if product wants it
elsewhere.

### Stripe Elements: client-side card → pm id, no server changes

- `components/StripeCardField.tsx`: `StripeElementsProvider` (always mounts
  `<Elements>`, with `stripe={null}` when unconfigured — `useStripe()` throws
  outside an Elements context, and consumers call the hook unconditionally),
  `CardEntryField` (CardElement in an iframe can't read CSS variables, so its
  colors hand-mirror tailwind.config.ts), `useCreateCardPaymentMethod`
  (createPaymentMethod → `pm_...` id). The raw card never touches this
  codebase — the existing routes' `paymentMethodId` contract is unchanged,
  which is why this needed zero server work.
- `BookingModal.tsx`: hardcoded `pm_card_visa` + its TODO gone; confirm now
  collects the card first. State moved into an inner component that mounts
  fresh per open (replaces the old manual reset-on-close bookkeeping).
- New env var `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (in `.env.example`;
  `NEXT_PUBLIC_` convention confirmed unchanged in this Next.js version's
  bundled docs). Unconfigured state degrades to a visible notice + disabled
  confirm, verified live — not a broken iframe.
- **Not verified: an actual card entry through the new field.** No
  publishable key exists in this dev env; product owner explicitly chose to
  skip rather than provide one this session. Everything up to Stripe's iframe
  boundary is verified. One booking with `4242 4242 4242 4242` after setting
  the key closes this.

### Refund/fee previews: same functions, not a client-side copy

The modals show the refund %, S$ amounts, and fee tier before the user
commits. To keep that preview from ever drifting from what the server
charges, split the pure calculators out of `lib/booking-payments.ts` into a
new client-safe `lib/booking-policy.ts` (booking-payments imports the
generated Prisma client for the tier→cadence mapping, which must not enter
the browser bundle; it now re-exports everything from booking-policy, so all
server imports and tests are untouched — `npm test` 244/244 after the split).
`CancelBookingModal` runs `calculateUserCancellationRefund` +
`applyRefundCap`; `ModifyBookingModal` runs `calculateModificationTerms` and
only renders the card field when the fee tier applies. Server still
recomputes at request time; the preview is advisory.

### Real bug found: activity feed crashed on the new enum values

First dashboard load crashed with "Element type is invalid... Check the
render method of `ActivityRow`" — `lib/hooks/useActivity.ts`'s
`ActivityActionType` union (and the page's exhaustive icon map keyed off it)
had never learned `booking_cancelled`, `booking_modified`, or
`bulk_order_confirmed_despite_insufficient_credit`, all added to the schema
enum by earlier backend sessions; the seeded DB already contained a
`booking_cancelled` row, so the whole dashboard crashed for ANY user before
this session's UI even entered the picture (and would have crashed on first
real cancel regardless). Fixed the union + icon map + "Bookings" category
filter + the `BOOKING_ACTION_TYPES` badge-linking set (cancel/modify
descriptions carry the same `Booking #<id>` pattern). Left a sync-warning
comment on the union pointing at the schema enum.

### Live verification (dev server, real logins, cleaned up after)

As `ethan@example.com`, three test bookings on listing 165 (Power Drill Set,
$25/day) at 1/5/25 days notice, all via the real UI:
- 1 day out: Modify → clean "starts too soon" ineligible modal; Cancel →
  preview 0% · S$0.00, executed: status `cancelled`, reason persisted, zero
  refund Transaction (correct for 0%).
- 25 days out: Modify free tier → "Free" badge, picked a date 5 days later,
  row updated to the new dates + "Rescheduled from Aug 15, 2026";
  DB confirmed `originalStartDate` set, `isModified` false,
  `maxRefundablePercent` 100.00, no fee row.
- 5 days out: Modify → fee tier preview "20% · S$5.00" + 50%-cap warning +
  (unconfigured) card notice with confirm disabled; Cancel → preview
  50% · S$12.50, executed: real Stripe refund, ledger `refund` row +12.50
  with live PaymentIntent id — preview matched execution exactly.
- All test rows (bookings, transactions, activity, the cancels'
  supplier_payables audit rows) deleted; counts re-confirmed at their
  pre-session baseline (5/10/8).
- `npx tsc --noEmit`, `npx eslint` clean on every touched file.

Also fixed while in the sprint plan: two stale lines contradicting closed
work — Sprint 3.5's "booking decline still has no refund mechanism" (closed
by the same-day decline rewrite) and Sprint 6's "InvoicingCadence mapping
undecided" (confirmed and built the same day).

### Not done

- Real-card verification (above).
- `Company.supplierTier` admin route/UI, `BookingCredit` issuance,
  Stripe webhooks — unchanged, still the next Sprint 6 items.

## Stripe Webhooks (2026-07-21)

Closed the last open Sprint 6 checklist item that didn't need a product
decision: "Stripe webhook tested in sandbox for all states: success, failure,
refund." No webhook route existed anywhere in the repo before this session
(confirmed by `find app/api -iname "*webhook*"`, zero hits).

### What this endpoint actually is, read from the existing code before
building anything

Every Stripe-charging write path in this codebase — `createBookingWithDebit`,
`modifyBookingWithFee`, `cancelBookingWithRefund`, `declineBookingWithRefund`
(all `lib/bookings.ts`) — calls Stripe with `confirm: true` and reads the
result synchronously in the same request, writing its own Transaction row
before returning. So a webhook here is **not** the primary write path for any
of these — it's the safety net those write paths already gesture at but can't
close themselves: `createBookingWithDebit`'s own catch block already has a
`console.error("...manual reconciliation required")` for the case where its
compensating refund itself fails, but nothing before this session actually
detected that class of gap after the fact. This webhook gives that existing
"manual reconciliation required" posture a real detection mechanism instead
of only a comment.

### What was built

- `lib/stripe-webhooks.ts`:
  - `constructStripeWebhookEvent(payload, signature)` — wraps
    `stripe.webhooks.constructEvent` against `STRIPE_WEBHOOK_SECRET`, throwing
    a new `StripeWebhookSignatureError` on any verification failure (bad
    signature, tampered payload, missing secret).
  - `handleStripeWebhookEvent(event)` — dispatches on `event.type`:
    - `payment_intent.succeeded`: looks up a `booking_payment`/
      `booking_modification_fee` Transaction by `stripePaymentIntentId` (the
      only two Transaction types a PaymentIntent maps to — grep-confirmed
      only two `stripe.paymentIntents.create` call sites exist, both in
      `lib/bookings.ts`). Found → silent no-op (the synchronous request
      already recorded it). Not found → `console.error` with the PaymentIntent
      id and amount: a real charge with no corresponding app-side record,
      which is exactly the "process died mid-request" gap.
    - `payment_intent.payment_failed`: `console.warn` only. Both charging
      functions already throw `StripeChargeFailedError` before writing
      anything if the synchronous result isn't `succeeded`, so there's never
      app state to roll back here — this is observability only (e.g. an
      off-session retry Stripe attempted on its own).
    - `charge.refunded`: looks up the original charge's Transaction by
      `stripePaymentIntentId` first. **No original Transaction at all** → a
      silent no-op — this is the fully-rolled-back compensating-refund case
      (the DB transaction wrapping the Booking create failed, so there was
      never a charge on this app's ledger to reconcile against in the first
      place, even though Stripe did receive money briefly). **Original
      Transaction exists** → sums this app's `refund`-type Transaction rows
      for that PaymentIntent and compares against Stripe's own
      `charge.amount_refunded`. A mismatch (a Dashboard-initiated refund this
      app never learned about, or a refund Transaction write that failed
      after `stripe.refunds.create` already succeeded) → `console.error`.
    - Anything else: acknowledged silently, not thrown — so Stripe doesn't
      retry-storm the endpoint over event types this app doesn't track.
- `app/api/webhooks/stripe/route.ts` — `POST` only, `runtime = "nodejs"`
  (Stripe's signature check needs Node's crypto). Reads the raw body via
  `request.text()` (confirmed against this fork's own bundled docs,
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
  §Webhooks — no `bodyParser` config needed in this App Router version,
  matching the "read the docs first" rule in `AGENTS.md`). No `auth()` call —
  Stripe's signature *is* the authentication here, there's no session cookie
  on a server-to-server webhook call. Missing signature header → clean `400`;
  invalid/tampered signature → clean `400`; otherwise dispatches to
  `handleStripeWebhookEvent` and returns `{ received: true }`.
- `STRIPE_WEBHOOK_SECRET` added to `.env`, `.env.testing`, and `.env.example`
  (placeholder in the latter). Any value works for local dev/test — signature
  verification is a local HMAC check against whatever secret this app itself
  was configured with, not a live round trip to Stripe. Noted in the env
  comment that production needs the real value from the Stripe Dashboard's
  webhook endpoint config (or `stripe listen`'s own secret if testing via the
  Stripe CLI, which isn't installed in this dev environment — confirmed via
  `which stripe`).

### Tests

`lib/stripe-webhooks.test.ts` (registered in `npm test`), hitting the real
Stripe test-mode sandbox for every PaymentIntent/refund involved (no mocking,
same convention as `lib/bookings.test.ts`) and signing synthetic event
payloads with Stripe's own `generateTestHeaderString` helper — this
faithfully exercises the real signature-verification code path without
needing `stripe listen` or a publicly reachable URL, since verification never
leaves the process. 10 cases: valid signature accepted, tampered payload
rejected, garbage signature header rejected, a recorded PaymentIntent is a
silent no-op, an orphan PaymentIntent (created directly via the SDK,
bypassing `createBookingWithDebit` on purpose) logs the reconciliation
warning with the right PaymentIntent id in the message, `payment_intent.
payment_failed` warns, a refund matching the ledger exactly is a silent
no-op, a refund with no matching `refund` Transaction warns, a refund on a
PaymentIntent with zero app-side Transactions at all (the rolled-back-attempt
case) is a silent no-op, and an unhandled event type doesn't throw. Full
suite: 254/254 passing, no regressions. `npx tsc --noEmit` and `npx eslint`
both clean on the three new files. `npx next build` succeeds,
`/api/webhooks/stripe` listed in the route manifest.

### Live verification, not just unit-tested

Restarted the dev server after editing `.env` (env vars are read once at
process boot, same reasoning as the stale-Prisma-client restart note in the
Sprint 4.75 Modify Booking session above — an env change needs the same
treatment). Then, from a scratch script run from the project root (so it
could resolve `stripe` from `node_modules`; deleted immediately after, not
committed), sent three real HTTP requests at the actually-running dev server:
- A `payment_intent.payment_failed` event, correctly signed with the real
  `STRIPE_WEBHOOK_SECRET` → `200 {"received":true}`, and the server's own log
  output confirmed the handler actually ran (not just returned a blind 200):
  `[stripe-webhook] payment_intent.payment_failed for pi_live_curl_test:
  Live curl test — your card was declined.`
- The same payload tampered after signing (amount changed) → clean
  `400 {"message":"Invalid webhook signature."}`.
- The same payload with no `stripe-signature` header at all → clean
  `400 {"message":"Missing stripe-signature header."}`.

### Also this session: Stripe publishable key added

The product owner supplied the test-mode `pk_test_...` publishable key
(pairing with the secret key already in `.env`) mid-session, closing the
"no publishable key exists in this dev environment" blocker the Sprint 4.75
Stripe Elements session left open. Added to `.env` (and confirmed
`.env.example`'s placeholder was already correct from that earlier session).
**Not yet done**: actually running one booking through the live UI with
`4242 4242 4242 4242` to confirm a real charge clears Stripe's iframe
boundary — queued as the next task, per the product owner's own instruction
to pick it up after this session's work. `Company.supplierTier` and
`BookingCredit` issuance from the "not done" list above are unaffected by
this session, still open.

### Not done this session

- The real-card-charge verification above — deliberately deferred to a
  follow-up task, not silently dropped.
- `BookingCredit` issuance — unchanged, still needs a product decision on
  where the first issuance flow lives (see the Sprint 6 item's own note).
- No second-reviewer sign-off on live payment code — that Sprint 6 checklist
  line is a human-process item, not something a session can close by itself.

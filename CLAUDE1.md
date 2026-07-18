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

// Structural guard, 2026-07-21 (consumables/gigs earned-credit rule): earned
// credits are compliance-restricted from ever being shown to a member as a
// dollar figure (see the comment on getEarnedBalance, lib/credits.ts, and
// SPRINT_PLAN_NEXTJS_REWRITE.md's "never expose earned credits as a dollar
// figure" constraint). This is a guard against future drift, not a claim
// that any endpoint currently exposes earnedBalance — none do yet. Pure
// static source scan, no DB, so it always runs as part of `npm test` without
// needing the dev DB up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(__dirname, "..", "app", "api");

function findRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry === "route.ts") {
      files.push(fullPath);
    }
  }
  return files;
}

test("no API route response references a raw earnedBalance value", () => {
  const routeFiles = findRouteFiles(API_DIR);
  assert.ok(routeFiles.length > 0, "expected to find at least one route.ts under app/api");

  const offenders = routeFiles.filter((file) => /earnedBalance/.test(readFileSync(file, "utf8")));

  assert.deepEqual(
    offenders.map((f) => f.replace(API_DIR, "app/api")),
    [],
    "An API route references earnedBalance directly. Earned credits must never be serialized as a raw currency figure " +
      "— return a structured reward description instead (e.g. { type: \"booking_discount_pct\", value: 10 }). " +
      "See getEarnedBalance's comment in lib/credits.ts."
  );
});

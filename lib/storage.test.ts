// Sprint 6.12 — coverage for the pure/deterministic parts of the new
// public-asset storage functions only (buildPublicAssetKey, getPublicAssetUrl).
// getPublicAssetUploadUrl/publicAssetExists need a real R2 round trip, same
// as getEvidenceUploadUrl/evidenceRecordingExists above them in storage.ts —
// this repo's existing convention (see certificate-signoffs.test.ts's own
// comment) is not to mock or hit real R2 in the test suite, so those two
// stay unverified here, same as their evidence-flow counterparts always have.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildPublicAssetKey, getPublicAssetUrl } from "./storage";

describe("buildPublicAssetKey", () => {
  test("admin EDM scope has no company segment", () => {
    const key = buildPublicAssetKey({ scope: "edm/admin", filename: "banner.png" });
    assert.match(key, /^public-assets\/edm\/admin\/\d+-[a-z0-9]+-banner\.png$/);
  });

  test("supplier EDM scope includes the company id segment", () => {
    const key = buildPublicAssetKey({ scope: "edm/supplier", filename: "ad.jpg", companyId: BigInt(42) });
    assert.match(key, /^public-assets\/edm\/supplier\/42\/\d+-[a-z0-9]+-ad\.jpg$/);
  });

  test("unsafe filename characters are sanitized", () => {
    const key = buildPublicAssetKey({ scope: "banner", filename: "my photo (final)!.png" });
    assert.doesNotMatch(key, /[()! ]/);
    assert.match(key, /\.png$/);
  });

  test("two calls for the same filename never collide", () => {
    const a = buildPublicAssetKey({ scope: "banner", filename: "x.png" });
    const b = buildPublicAssetKey({ scope: "banner", filename: "x.png" });
    assert.notEqual(a, b);
  });
});

describe("getPublicAssetUrl", () => {
  test("throws when R2_PUBLIC_BASE_URL is not configured", () => {
    const prev = process.env.R2_PUBLIC_BASE_URL;
    delete process.env.R2_PUBLIC_BASE_URL;
    try {
      assert.throws(() => getPublicAssetUrl("public-assets/banner/x.png"), /R2_PUBLIC_BASE_URL/);
    } finally {
      if (prev !== undefined) process.env.R2_PUBLIC_BASE_URL = prev;
    }
  });

  test("joins base and key with exactly one slash, trailing slash on base tolerated", () => {
    const prev = process.env.R2_PUBLIC_BASE_URL;
    process.env.R2_PUBLIC_BASE_URL = "https://pub-example.r2.dev/";
    try {
      assert.equal(getPublicAssetUrl("public-assets/banner/x.png"), "https://pub-example.r2.dev/public-assets/banner/x.png");
    } finally {
      if (prev !== undefined) process.env.R2_PUBLIC_BASE_URL = prev;
      else delete process.env.R2_PUBLIC_BASE_URL;
    }
  });
});

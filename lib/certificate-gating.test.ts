// Unit tests for Sprint 4 item 2 (revised scope) certificate-set gating
// (lib/certificate-gating.ts). Pure logic, no DB — covers the Sprint 4
// checklist's edge cases: holds all required (pass), missing one of several,
// holds none, expired treated as missing, no certs required. Extended
// (session: feat/credential-provenance) with the provenance/listing matrix:
// internal credential vs. a listing's accepts_internal_signoff setting.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CredentialProvenance } from "@/app/generated/prisma/client";
import { getMissingCertificates } from "./certificate-gating";

// Provenance is irrelevant to these pre-existing cases (none are internal),
// so every fixture here uses an arbitrary non-internal provenance and
// acceptsInternalSignoff: true, matching the pre-provenance behavior.
const NON_INTERNAL = CredentialProvenance.tier1_video_quiz;

describe("getMissingCertificates", () => {
  const asOf = new Date("2026-07-19");

  test("user holds all required certificates: nothing missing", () => {
    const missing = getMissingCertificates(
      ["cert-a", "cert-b"],
      [
        { certificateId: "cert-a", expiryDate: null, earnedVia: NON_INTERNAL },
        { certificateId: "cert-b", expiryDate: "2027-01-01", earnedVia: NON_INTERNAL },
      ],
      true,
      asOf
    );
    assert.deepEqual(missing, []);
  });

  test("user missing one of several required certificates: returns just that one", () => {
    const missing = getMissingCertificates(
      ["cert-a", "cert-b", "cert-c"],
      [
        { certificateId: "cert-a", expiryDate: null, earnedVia: NON_INTERNAL },
        { certificateId: "cert-c", expiryDate: null, earnedVia: NON_INTERNAL },
      ],
      true,
      asOf
    );
    assert.deepEqual(missing, ["cert-b"]);
  });

  test("user holds none of the required certificates: returns all of them", () => {
    const missing = getMissingCertificates(["cert-a", "cert-b"], [], true, asOf);
    assert.deepEqual(missing, ["cert-a", "cert-b"]);
  });

  test("held certificate but expired: treated as missing", () => {
    const missing = getMissingCertificates(
      ["cert-a"],
      [{ certificateId: "cert-a", expiryDate: "2026-01-01", earnedVia: NON_INTERNAL }],
      true,
      asOf
    );
    assert.deepEqual(missing, ["cert-a"]);
  });

  test("no certificates required at all: empty result, always passes", () => {
    const missing = getMissingCertificates(
      [],
      [{ certificateId: "cert-a", expiryDate: null, earnedVia: NON_INTERNAL }],
      true,
      asOf
    );
    assert.deepEqual(missing, []);
  });

  test("a held certificate expiring exactly on asOf still counts as held", () => {
    const missing = getMissingCertificates(
      ["cert-a"],
      [{ certificateId: "cert-a", expiryDate: asOf, earnedVia: NON_INTERNAL }],
      true,
      asOf
    );
    assert.deepEqual(missing, []);
  });

  test("unrelated held certificates do not mask a genuinely missing one", () => {
    const missing = getMissingCertificates(
      ["cert-a"],
      [{ certificateId: "cert-unrelated", expiryDate: null, earnedVia: NON_INTERNAL }],
      true,
      asOf
    );
    assert.deepEqual(missing, ["cert-a"]);
  });

  test("internal credential + listing accepting internal sign-off: satisfied", () => {
    const missing = getMissingCertificates(
      ["cert-a"],
      [{ certificateId: "cert-a", expiryDate: null, earnedVia: CredentialProvenance.tier2a1_internal_company_signoff }],
      true,
      asOf
    );
    assert.deepEqual(missing, []);
  });

  test("internal credential + listing NOT accepting internal sign-off: missing", () => {
    const missing = getMissingCertificates(
      ["cert-a"],
      [{ certificateId: "cert-a", expiryDate: null, earnedVia: CredentialProvenance.tier2a1_internal_company_signoff }],
      false,
      asOf
    );
    assert.deepEqual(missing, ["cert-a"]);
  });

  test("operator credential + listing NOT accepting internal sign-off: still satisfied", () => {
    const missing = getMissingCertificates(
      ["cert-a"],
      [{ certificateId: "cert-a", expiryDate: null, earnedVia: CredentialProvenance.tier2a_operator_signoff }],
      false,
      asOf
    );
    assert.deepEqual(missing, []);
  });
});

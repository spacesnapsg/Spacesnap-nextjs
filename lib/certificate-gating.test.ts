// Unit tests for Sprint 4 item 2 (revised scope) certificate-set gating
// (lib/certificate-gating.ts). Pure logic, no DB — covers the Sprint 4
// checklist's edge cases: holds all required (pass), missing one of several,
// holds none, expired treated as missing, no certs required.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMissingCertificates } from "./certificate-gating";

describe("getMissingCertificates", () => {
  const asOf = new Date("2026-07-19");

  test("user holds all required certificates: nothing missing", () => {
    const missing = getMissingCertificates(
      ["cert-a", "cert-b"],
      [
        { certificateId: "cert-a", expiryDate: null },
        { certificateId: "cert-b", expiryDate: "2027-01-01" },
      ],
      asOf
    );
    assert.deepEqual(missing, []);
  });

  test("user missing one of several required certificates: returns just that one", () => {
    const missing = getMissingCertificates(
      ["cert-a", "cert-b", "cert-c"],
      [
        { certificateId: "cert-a", expiryDate: null },
        { certificateId: "cert-c", expiryDate: null },
      ],
      asOf
    );
    assert.deepEqual(missing, ["cert-b"]);
  });

  test("user holds none of the required certificates: returns all of them", () => {
    const missing = getMissingCertificates(["cert-a", "cert-b"], [], asOf);
    assert.deepEqual(missing, ["cert-a", "cert-b"]);
  });

  test("held certificate but expired: treated as missing", () => {
    const missing = getMissingCertificates(
      ["cert-a"],
      [{ certificateId: "cert-a", expiryDate: "2026-01-01" }],
      asOf
    );
    assert.deepEqual(missing, ["cert-a"]);
  });

  test("no certificates required at all: empty result, always passes", () => {
    const missing = getMissingCertificates([], [{ certificateId: "cert-a", expiryDate: null }], asOf);
    assert.deepEqual(missing, []);
  });

  test("a held certificate expiring exactly on asOf still counts as held", () => {
    const missing = getMissingCertificates(
      ["cert-a"],
      [{ certificateId: "cert-a", expiryDate: asOf }],
      asOf
    );
    assert.deepEqual(missing, []);
  });

  test("unrelated held certificates do not mask a genuinely missing one", () => {
    const missing = getMissingCertificates(
      ["cert-a"],
      [{ certificateId: "cert-unrelated", expiryDate: null }],
      asOf
    );
    assert.deepEqual(missing, ["cert-a"]);
  });
});

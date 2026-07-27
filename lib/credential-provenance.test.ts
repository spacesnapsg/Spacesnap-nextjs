// Unit tests for credential provenance (session: feat/credential-provenance).
// Pure logic, no DB — mirrors lib/certificate-gating.test.ts's pattern.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CredentialProvenance } from "@/app/generated/prisma/client";
import {
  PROVENANCE_RANK,
  isStrongerProvenance,
  resolveProvenanceOnRenewal,
  satisfiesListing,
  PROVENANCE_LABEL,
  getProvenanceTooltip,
} from "./credential-provenance";

const ALL_PROVENANCES = [
  CredentialProvenance.tier1_video_quiz,
  CredentialProvenance.tier2a_operator_signoff,
  CredentialProvenance.tier2a1_internal_company_signoff,
  CredentialProvenance.tier2b_operator_or_sme_signoff,
];

describe("PROVENANCE_RANK / isStrongerProvenance", () => {
  test("internal company sign-off ranks strictly below the other three", () => {
    for (const other of ALL_PROVENANCES) {
      if (other === CredentialProvenance.tier2a1_internal_company_signoff) continue;
      assert.ok(
        PROVENANCE_RANK[other] > PROVENANCE_RANK[CredentialProvenance.tier2a1_internal_company_signoff]
      );
    }
  });

  test("tier1, tier2a, and tier2b all rank equally above internal", () => {
    assert.equal(PROVENANCE_RANK.tier1_video_quiz, PROVENANCE_RANK.tier2a_operator_signoff);
    assert.equal(PROVENANCE_RANK.tier1_video_quiz, PROVENANCE_RANK.tier2b_operator_or_sme_signoff);
  });

  test("any non-internal provenance is stronger than internal", () => {
    assert.equal(
      isStrongerProvenance(CredentialProvenance.tier2a_operator_signoff, CredentialProvenance.tier2a1_internal_company_signoff),
      true
    );
  });

  test("internal is never stronger than a non-internal provenance", () => {
    assert.equal(
      isStrongerProvenance(CredentialProvenance.tier2a1_internal_company_signoff, CredentialProvenance.tier1_video_quiz),
      false
    );
  });

  test("equal-rank provenances are not stronger than each other", () => {
    assert.equal(
      isStrongerProvenance(CredentialProvenance.tier1_video_quiz, CredentialProvenance.tier2b_operator_or_sme_signoff),
      false
    );
  });
});

describe("resolveProvenanceOnRenewal", () => {
  test("a later internal sign-off never downgrades an existing operator credential", () => {
    const resolved = resolveProvenanceOnRenewal(
      CredentialProvenance.tier2a_operator_signoff,
      CredentialProvenance.tier2a1_internal_company_signoff
    );
    assert.equal(resolved, CredentialProvenance.tier2a_operator_signoff);
  });

  test("a later operator sign-off upgrades an existing internal-only credential", () => {
    const resolved = resolveProvenanceOnRenewal(
      CredentialProvenance.tier2a1_internal_company_signoff,
      CredentialProvenance.tier2a_operator_signoff
    );
    assert.equal(resolved, CredentialProvenance.tier2a_operator_signoff);
  });

  test("equal ranks are a no-op: existing is returned unchanged", () => {
    const resolved = resolveProvenanceOnRenewal(
      CredentialProvenance.tier1_video_quiz,
      CredentialProvenance.tier2b_operator_or_sme_signoff
    );
    assert.equal(resolved, CredentialProvenance.tier1_video_quiz);
  });

  test("re-earning via the same provenance is a no-op", () => {
    const resolved = resolveProvenanceOnRenewal(
      CredentialProvenance.tier2a1_internal_company_signoff,
      CredentialProvenance.tier2a1_internal_company_signoff
    );
    assert.equal(resolved, CredentialProvenance.tier2a1_internal_company_signoff);
  });
});

describe("satisfiesListing", () => {
  for (const provenance of ALL_PROVENANCES) {
    const expectedWhenNotAccepting = provenance !== CredentialProvenance.tier2a1_internal_company_signoff;

    test(`${provenance} on a listing accepting internal sign-off: always satisfies`, () => {
      assert.equal(satisfiesListing(provenance, true), true);
    });

    test(`${provenance} on a listing NOT accepting internal sign-off: satisfies ${expectedWhenNotAccepting}`, () => {
      assert.equal(satisfiesListing(provenance, false), expectedWhenNotAccepting);
    });
  }
});

describe("PROVENANCE_LABEL / getProvenanceTooltip", () => {
  test("every provenance value has a non-empty label", () => {
    for (const provenance of ALL_PROVENANCES) {
      assert.equal(typeof PROVENANCE_LABEL[provenance], "string");
      assert.ok(PROVENANCE_LABEL[provenance].length > 0);
    }
  });

  test("only internal company sign-off gets an explanatory tooltip", () => {
    for (const provenance of ALL_PROVENANCES) {
      const tooltip = getProvenanceTooltip(provenance);
      if (provenance === CredentialProvenance.tier2a1_internal_company_signoff) {
        assert.equal(typeof tooltip, "string");
        assert.ok(tooltip && tooltip.length > 0);
      } else {
        assert.equal(tooltip, null);
      }
    }
  });
});

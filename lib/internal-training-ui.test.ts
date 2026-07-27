// Unit tests for internal training UI decision logic (session:
// feat/internal-training-ui). Pure logic, no DB — mirrors
// lib/credential-provenance.test.ts's pattern.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getReviewDisabledReason, buildSignoffQueue } from "./internal-training-ui";

describe("getReviewDisabledReason", () => {
  test("pass is disabled with a reason when the participant has no evidence", () => {
    const reason = getReviewDisabledReason({ status: "pending_evidence", hasEvidence: false }, "pass");
    assert.equal(typeof reason, "string");
    assert.ok(reason && reason.length > 0);
  });

  test("fail is allowed without evidence", () => {
    const reason = getReviewDisabledReason({ status: "pending_evidence", hasEvidence: false }, "fail");
    assert.equal(reason, null);
  });

  test("pass is allowed once evidence has been uploaded", () => {
    const reason = getReviewDisabledReason({ status: "awaiting_signoff", hasEvidence: true }, "pass");
    assert.equal(reason, null);
  });

  test("an already-passed participant is disabled for either decision, taking precedence over the evidence check", () => {
    assert.notEqual(getReviewDisabledReason({ status: "passed", hasEvidence: false }, "pass"), null);
    assert.notEqual(getReviewDisabledReason({ status: "passed", hasEvidence: true }, "fail"), null);
  });

  test("an already-failed participant is disabled for either decision", () => {
    assert.notEqual(getReviewDisabledReason({ status: "failed", hasEvidence: true }, "pass"), null);
    assert.notEqual(getReviewDisabledReason({ status: "failed", hasEvidence: false }, "fail"), null);
  });
});

describe("buildSignoffQueue", () => {
  test("no events yields an empty queue", () => {
    assert.deepEqual(buildSignoffQueue([]), []);
  });

  test("an event with no participants key is handled defensively", () => {
    assert.deepEqual(buildSignoffQueue([{ id: "1", title: "Untitled" }]), []);
  });

  test("only awaiting_signoff participants surface, in encounter order, across multiple events", () => {
    const queue = buildSignoffQueue([
      {
        id: "1",
        title: "Gravimetric Calibration",
        participants: [
          { id: "p1", userId: "u1", status: "pending_evidence" },
          { id: "p2", userId: "u2", status: "awaiting_signoff" },
          { id: "p3", userId: "u3", status: "passed" },
        ],
      },
      {
        id: "2",
        title: "Forklift Refresher",
        participants: [
          { id: "p4", userId: "u4", status: "awaiting_signoff" },
          { id: "p5", userId: "u5", status: "failed" },
        ],
      },
    ]);

    assert.deepEqual(queue, [
      { eventId: "1", eventTitle: "Gravimetric Calibration", participantId: "p2", userId: "u2" },
      { eventId: "2", eventTitle: "Forklift Refresher", participantId: "p4", userId: "u4" },
    ]);
  });
});

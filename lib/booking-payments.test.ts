// Unit tests for the cancellation-window pure calculators
// (lib/booking-payments.ts). Pure logic, no DB — covers the boundary days
// named in this session's own brief (day 7, day 3, day 0) exactly, since an
// off-by-one here is a real money bug, not just a cosmetic mismatch.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateUserCancellationRefund,
  calculateSupplierCancellationPenalty,
  calculateModificationTerms,
  applyRefundCap,
} from "./booking-payments";

describe("calculateUserCancellationRefund", () => {
  const startDate = "2026-08-08";

  test("exactly 7 days before session start: 100% refund", () => {
    assert.equal(calculateUserCancellationRefund({ startDate }, new Date("2026-08-01T00:00:00Z")), 100);
  });

  test("8 days before (comfortably inside the top tier): 100% refund", () => {
    assert.equal(calculateUserCancellationRefund({ startDate }, new Date("2026-07-31T12:00:00Z")), 100);
  });

  test("6 days before (just inside the 7-day boundary): 50% refund, not 100%", () => {
    assert.equal(calculateUserCancellationRefund({ startDate }, new Date("2026-08-02T00:00:00Z")), 50);
  });

  test("exactly 3 days before session start: 50% refund", () => {
    assert.equal(calculateUserCancellationRefund({ startDate }, new Date("2026-08-05T00:00:00Z")), 50);
  });

  test("2 days before (just inside the 3-day boundary): 0% refund, not 50%", () => {
    assert.equal(calculateUserCancellationRefund({ startDate }, new Date("2026-08-06T00:00:00Z")), 0);
  });

  test("exactly day 0 (cancelling on the session's start date): 0% refund", () => {
    assert.equal(calculateUserCancellationRefund({ startDate }, new Date("2026-08-08T00:00:00Z")), 0);
  });

  test("cancelling after the session has already started: 0% refund", () => {
    assert.equal(calculateUserCancellationRefund({ startDate }, new Date("2026-08-09T00:00:00Z")), 0);
  });

  test("time-of-day on the cancellation timestamp doesn't shift the tier: late in the day, still 7 calendar days out", () => {
    assert.equal(calculateUserCancellationRefund({ startDate }, new Date("2026-08-01T23:59:59Z")), 100);
  });

  test("time-of-day on the cancellation timestamp doesn't shift the tier: early in the day, still 7 calendar days out", () => {
    assert.equal(calculateUserCancellationRefund({ startDate }, new Date("2026-08-01T00:00:01Z")), 100);
  });

  test("accepts a Date object for startDate, not just a string", () => {
    assert.equal(
      calculateUserCancellationRefund({ startDate: new Date("2026-08-08T00:00:00Z") }, new Date("2026-08-01T00:00:00Z")),
      100
    );
  });
});

describe("calculateSupplierCancellationPenalty", () => {
  const startDate = "2026-08-08";

  test("exactly 7 days before session start: 0% penalty", () => {
    assert.equal(calculateSupplierCancellationPenalty({ startDate }, new Date("2026-08-01T00:00:00Z")), 0);
  });

  test("6 days before (just inside the 7-day boundary): 50% penalty, not 0%", () => {
    assert.equal(calculateSupplierCancellationPenalty({ startDate }, new Date("2026-08-02T00:00:00Z")), 50);
  });

  test("exactly 3 days before session start: 50% penalty", () => {
    assert.equal(calculateSupplierCancellationPenalty({ startDate }, new Date("2026-08-05T00:00:00Z")), 50);
  });

  test("2 days before (just inside the 3-day boundary): 100% penalty, not 50%", () => {
    assert.equal(calculateSupplierCancellationPenalty({ startDate }, new Date("2026-08-06T00:00:00Z")), 100);
  });

  test("exactly day 0 (cancelling on the session's start date): 100% penalty", () => {
    assert.equal(calculateSupplierCancellationPenalty({ startDate }, new Date("2026-08-08T00:00:00Z")), 100);
  });

  test("cancelling after the session has already started: 100% penalty", () => {
    assert.equal(calculateSupplierCancellationPenalty({ startDate }, new Date("2026-08-09T00:00:00Z")), 100);
  });

  test("mirrors the user-refund tiers exactly (100-x at every boundary)", () => {
    const cancelledAtByDaysBefore: Record<number, string> = {
      8: "2026-07-31T00:00:00Z",
      7: "2026-08-01T00:00:00Z",
      3: "2026-08-05T00:00:00Z",
      2: "2026-08-06T00:00:00Z",
      0: "2026-08-08T00:00:00Z",
    };
    for (const [, cancelledAt] of Object.entries(cancelledAtByDaysBefore)) {
      const refund = calculateUserCancellationRefund({ startDate }, new Date(cancelledAt));
      const penalty = calculateSupplierCancellationPenalty({ startDate }, new Date(cancelledAt));
      assert.equal(penalty, 100 - refund);
    }
  });
});

// Sprint 4.75 — "Modify Booking" eligibility/fee/cap engine. The boundary at
// day 7 is deliberately the OPPOSITE inclusivity from the cancellation tiers
// above (free tier here is "> 7", not ">= 7"), per the product brief's own
// pseudocode — covered explicitly so a future session doesn't "fix" it to
// match cancellation's boundary by mistake.
describe("calculateModificationTerms", () => {
  const startDate = "2026-08-08";

  test("8 days before (comfortably inside the free tier): eligible, no fee, 100% cap", () => {
    const result = calculateModificationTerms({ startDate }, new Date("2026-07-31T00:00:00Z"));
    assert.deepEqual(result, { eligible: true, noticeDays: 8, feePercent: 0, maxRefundablePercent: 100 });
  });

  test("exactly 7 days before: NOT the free tier (> 7 required) — falls into the 20% fee tier", () => {
    const result = calculateModificationTerms({ startDate }, new Date("2026-08-01T00:00:00Z"));
    assert.deepEqual(result, { eligible: true, noticeDays: 7, feePercent: 20, maxRefundablePercent: 50 });
  });

  test("exactly 3 days before: still the 20% fee tier (inclusive lower bound)", () => {
    const result = calculateModificationTerms({ startDate }, new Date("2026-08-05T00:00:00Z"));
    assert.deepEqual(result, { eligible: true, noticeDays: 3, feePercent: 20, maxRefundablePercent: 50 });
  });

  test("2 days before (just inside the 3-day boundary): rejected, not eligible", () => {
    const result = calculateModificationTerms({ startDate }, new Date("2026-08-06T00:00:00Z"));
    assert.deepEqual(result, { eligible: false, noticeDays: 2 });
  });

  test("modifying on or after the session's start date: rejected, not eligible", () => {
    assert.deepEqual(calculateModificationTerms({ startDate }, new Date("2026-08-08T00:00:00Z")), {
      eligible: false,
      noticeDays: 0,
    });
    assert.deepEqual(calculateModificationTerms({ startDate }, new Date("2026-08-09T00:00:00Z")), {
      eligible: false,
      noticeDays: -1,
    });
  });

  test("time-of-day on the request timestamp doesn't shift the tier", () => {
    assert.deepEqual(calculateModificationTerms({ startDate }, new Date("2026-07-31T23:59:59Z")), {
      eligible: true,
      noticeDays: 8,
      feePercent: 0,
      maxRefundablePercent: 100,
    });
  });
});

describe("applyRefundCap", () => {
  test("null cap (never modified) is a no-op: standard percentage passes through unchanged", () => {
    assert.equal(applyRefundCap(100, null), 100);
    assert.equal(applyRefundCap(50, null), 50);
    assert.equal(applyRefundCap(0, null), 0);
  });

  test("cap below the standard refund wins", () => {
    assert.equal(applyRefundCap(100, 50), 50);
  });

  test("cap above the standard refund is a no-op (standard already lower)", () => {
    assert.equal(applyRefundCap(50, 100), 50);
  });

  test("cap equal to the standard refund is unaffected", () => {
    assert.equal(applyRefundCap(50, 50), 50);
  });

  test("cap of 0 zeroes out any standard refund", () => {
    assert.equal(applyRefundCap(100, 0), 0);
  });
});

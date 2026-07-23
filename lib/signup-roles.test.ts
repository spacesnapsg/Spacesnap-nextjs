import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseSignupRole, resolveIsMember } from "./signup-roles";

describe("parseSignupRole", () => {
  test("accepts the three valid roles", () => {
    assert.equal(parseSignupRole("member"), "member");
    assert.equal(parseSignupRole("supplier"), "supplier");
    assert.equal(parseSignupRole("both"), "both");
  });

  test("rejects anything else, including undefined/non-string", () => {
    assert.equal(parseSignupRole("admin"), null);
    assert.equal(parseSignupRole(undefined), null);
    assert.equal(parseSignupRole(null), null);
    assert.equal(parseSignupRole(42), null);
  });
});

describe("resolveIsMember", () => {
  test("supplier-only is the sole role that loses user access", () => {
    assert.equal(resolveIsMember("supplier"), false);
  });

  test("member and both keep user access", () => {
    assert.equal(resolveIsMember("member"), true);
    assert.equal(resolveIsMember("both"), true);
  });

  test("no role selected (legacy/API-only registration) defaults to true", () => {
    assert.equal(resolveIsMember(null), true);
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSignature } from "../auth/admin-auth.js";

test("generateSignature produces base64url HMAC-SHA256 of Content/Timestamp message", () => {
  const sig = generateSignature("test-secret", '{"login":1}', 1781032371788983);
  assert.equal(sig, "VHro3dxIVYvD29rENMhg772MfN3hipqzVn4tilRnOnI");
  assert.match(sig, /^[A-Za-z0-9_-]+$/); // base64url, no padding
  assert.ok(!sig.includes("=") && !sig.includes("+") && !sig.includes("/"));
});

test("different secret produces different signature", () => {
  const a = generateSignature("secretA", "{}", 1000);
  const b = generateSignature("secretB", "{}", 1000);
  assert.notEqual(a, b);
});

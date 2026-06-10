import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { getRequestUserId } from "./authUser";

function requestWith(fields: Partial<Request>): Request {
  return fields as Request;
}

test("getRequestUserId prefers Supabase user id", () => {
  const req = requestWith({
    user: {
      id: "supabase-user-id",
      claims: { sub: "legacy-claims-id" },
    },
    session: { userId: 42 } as Request["session"],
  });

  assert.equal(getRequestUserId(req), "supabase-user-id");
});

test("getRequestUserId supports legacy claims users", () => {
  const req = requestWith({
    user: {
      claims: { sub: "legacy-claims-id" },
    },
  });

  assert.equal(getRequestUserId(req), "legacy-claims-id");
});

test("getRequestUserId preserves legacy numeric session ids", () => {
  const req = requestWith({
    session: { userId: 42 } as Request["session"],
  });

  assert.equal(getRequestUserId(req), 42);
});

test("getRequestUserId returns null without an authenticated user", () => {
  assert.equal(getRequestUserId(requestWith({})), null);
});

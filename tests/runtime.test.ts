import { test } from "node:test";
import assert from "node:assert/strict";
import { runtimeMode, safeNext } from "../lib/runtime";
test("production requires a database or explicit demo flag", () => {
  assert.equal(runtimeMode({ production: true }), "unconfigured");
  assert.equal(runtimeMode({ production: false }), "demo");
  assert.equal(runtimeMode({ production: true, demo: "true" }), "demo");
  assert.equal(
    runtimeMode({ production: false, demo: "false" }),
    "unconfigured",
  );
  assert.equal(
    runtimeMode({ production: false, url: "https://project.supabase.co" }),
    "unconfigured",
  );
});
test("production never accepts secret service-role keys or invalid database URLs", () => {
  assert.equal(
    runtimeMode({
      production: true,
      url: "https://project.supabase.co",
      key: "sb_secret_fake",
    }),
    "unconfigured",
  );
  assert.equal(
    runtimeMode({
      production: true,
      url: "http://project.supabase.co",
      key: "sb_publishable_fake",
    }),
    "unconfigured",
  );
  assert.equal(
    runtimeMode({
      production: true,
      url: "https://project.supabase.co",
      key: "sb_publishable_fake",
    }),
    "live",
  );
  const token =
    "a." +
    Buffer.from(JSON.stringify({ role: "service_role" })).toString(
      "base64url",
    ) +
    ".c";
  assert.equal(
    runtimeMode({
      production: true,
      url: "https://project.supabase.co",
      key: token,
    }),
    "unconfigured",
  );
});
test("authentication redirects remain on same site", () => {
  for (const path of [
    "//evil.test",
    "https://evil.test",
    "/\\evil.test",
    "/\nLocation: x",
  ])
    assert.equal(safeNext(path), "/");
  assert.equal(safeNext("/join?token=test"), "/join?token=test");
  assert.equal(safeNext("/account/password"), "/account/password");
});

test("role demo datasets are scoped before reaching the browser", async () => {
  const { demoView } = await import("../lib/demo-view");
  const athlete = demoView("athlete");
  assert.equal(athlete.data.athletes.length, 1);
  const id = athlete.viewer.athlete_id;
  assert.ok(athlete.data.entries.every((e) => e.athlete_id === id));
  assert.ok(
    athlete.data.sessions.every((s) => s.athlete_ids.every((a) => a === id)),
  );
  const coach = demoView("coach");
  assert.ok(coach.data.athletes.every((a) => a.team_id === "first"));
  assert.ok(coach.data.sessions.every((s) => s.team_id === "first"));
});

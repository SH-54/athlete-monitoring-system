import { test as base, expect } from "@playwright/test";
export const test = base.extend({});
test.beforeEach(async ({ request }) => {
  const r = await request.get("/");
  const html = await r.text();
  if (!r.ok() || !html.includes('data-demo="true"'))
    throw new Error(
      "These browser tests only run against an explicit fictional-data demo. Real team data must not be modified by acceptance tests.",
    );
});
export { expect };

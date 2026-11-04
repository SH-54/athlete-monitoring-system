// Run in-process so the managed sandbox does not need child test processes.
import { readdir } from "node:fs/promises";
for (const file of (await readdir(new URL("../tests/", import.meta.url)))
  .filter((n) => n.endsWith(".test.ts"))
  .sort())
  await import(new URL(`../tests/${file}`, import.meta.url));

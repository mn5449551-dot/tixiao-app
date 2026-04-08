import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dbPath = new URL("../db.ts", import.meta.url);

test("db module marks its process cwd path lookup as turbopack-ignored", async () => {
  const source = await readFile(dbPath, "utf8");

  assert.match(source, /turbopackIgnore:\s*true/);
});

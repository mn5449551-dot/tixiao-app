import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homePagePath = new URL("../../app/page.tsx", import.meta.url);
const projectListPath = new URL("../../components/dashboard/project-list.tsx", import.meta.url);

test("homepage hero copy is rewritten for the operator-facing workbench", async () => {
  const source = await readFile(homePagePath, "utf8");

  assert.match(source, /AI 图文生产工作台/);
  assert.match(source, /集中管理您的 AI 图文创作项目与素材资产。/);
  assert.match(source, /方向卡总数/);
  assert.match(source, /文案卡总数/);
  assert.doesNotMatch(source, /已接入本地 SQLite/);
});

test("project list uses textual enter action and hover-softened delete action", async () => {
  const source = await readFile(projectListPath, "utf8");

  assert.match(source, /进入 >/);
  assert.match(source, /group-hover:opacity-100/);
  assert.doesNotMatch(source, /flex h-8 w-8 items-center justify-center rounded-full/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homePagePath = new URL("../../app/page.tsx", import.meta.url);
const folderListPath = new URL("../../components/dashboard/folder-list.tsx", import.meta.url);
const projectListPath = new URL("../../components/dashboard/project-list.tsx", import.meta.url);

test("homepage hero copy is rewritten for the operator-facing workbench", async () => {
  const source = await readFile(homePagePath, "utf8");

  assert.match(source, /AI 图文生产工作台/);
  assert.match(source, /我的文件夹/);
  assert.match(source, /还没有文件夹/);
  assert.match(source, /新建文件夹/);
  assert.doesNotMatch(source, /已接入本地 SQLite/);
});

test("project list uses textual enter action and hover-softened delete action", async () => {
  const source = await readFile(projectListPath, "utf8");

  assert.match(source, /进入 >/);
  assert.match(source, /group-hover:opacity-100/);
  assert.doesNotMatch(source, /flex h-8 w-8 items-center justify-center rounded-full/);
});

test("folder list warns that deleting a folder permanently removes all child projects and assets", async () => {
  const source = await readFile(folderListPath, "utf8");

  assert.match(source, /永久删除该文件夹下的全部项目和素材/);
  assert.match(source, /无法恢复/);
  assert.doesNotMatch(source, /移到"未分类"/);
});

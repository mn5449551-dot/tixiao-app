import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCopyIdeas } from "../project-data-modules-internal";

test("normalizeCopyIdeas rejects overlong double-image copy", () => {
  const result = normalizeCopyIdeas({
    copies: [
      {
        titleMain: "这个双图文案已经明显超过十个字了",
        titleSub: "这一句也远远超过十个字了",
        copyType: "因果",
      },
    ],
  }, 1, "double");

  assert.equal(result, null);
});

test("normalizeCopyIdeas rejects overlong triple-image copy and requires titleExtra", () => {
  const result = normalizeCopyIdeas({
    copies: [
      {
        titleMain: "第一句超过十个字了吧",
        titleSub: "第二句也超过十个字了吧",
        titleExtra: null,
        copyType: "递进",
      },
    ],
  }, 1, "triple");

  assert.equal(result, null);
});

test("normalizeCopyIdeas keeps single-image copy within title limits", () => {
  const result = normalizeCopyIdeas({
    copies: [
      {
        titleMain: "拍一下就学会",
        titleSub: "10秒出解析像老师边写边讲",
        copyType: "单图主副标题",
      },
    ],
  }, 1, "single");

  assert.deepEqual(result, [
    {
      titleMain: "拍一下就学会",
      titleSub: "10秒出解析像老师边写边讲",
      titleExtra: null,
      copyType: "单图主副标题",
    },
  ]);
});

import test from "node:test";
import assert from "node:assert/strict";

import { recommendRequirementFields } from "../ai/agents/requirement-agent";

test("recommendRequirementFields returns human-readable feature and selling point text", () => {
  const recommendation = recommendRequirementFields("家长场景，想推拍题功能，重点突出10秒出解析和像老师边写边讲，期中考试使用");

  assert.equal(recommendation.feature, "拍题精学");
  assert.deepEqual(recommendation.sellingPoints, ["10 秒出解析", "像老师边写边讲"]);
});

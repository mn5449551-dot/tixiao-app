import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultDirectionGenerationInput,
  resolveImageStyleForMode,
  shouldShowImageStyleField,
  shouldShowIpAssetSelector,
} from "../workflow-defaults";

test("getDefaultDirectionGenerationInput prefers a multi-image channel for parent audience", () => {
  assert.deepEqual(getDefaultDirectionGenerationInput("parent"), {
    channel: "应用商店",
    imageForm: "double",
  });
});

test("getDefaultDirectionGenerationInput prefers a multi-image channel for student audience", () => {
  assert.deepEqual(getDefaultDirectionGenerationInput("student"), {
    channel: "应用商店",
    imageForm: "double",
  });
});

test("resolveImageStyleForMode locks to animation when style mode is ip", () => {
  assert.equal(resolveImageStyleForMode("ip", "realistic"), "animation");
});

test("resolveImageStyleForMode keeps the selected style in normal mode", () => {
  assert.equal(resolveImageStyleForMode("normal", "felt"), "felt");
});

test("shouldShowImageStyleField hides image style when ip mode is selected", () => {
  assert.equal(shouldShowImageStyleField("ip"), false);
  assert.equal(shouldShowImageStyleField("normal"), true);
});

test("shouldShowIpAssetSelector shows ip thumbnails in ip mode or when ip is enabled manually", () => {
  assert.equal(shouldShowIpAssetSelector("ip", false), true);
  assert.equal(shouldShowIpAssetSelector("normal", true), true);
  assert.equal(shouldShowIpAssetSelector("normal", false), false);
});

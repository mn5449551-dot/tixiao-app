import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import {
  getAppDataRoot,
  getDbFilePath,
  getStorageRootPath,
  getLegacyDbFilePath,
  getLegacyStorageRoot,
} from "../runtime-paths";

test("test mode uses an isolated temp app data root", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;
  const previousDataRoot = env.TIXIAO_DATA_ROOT;

  env.NODE_ENV = "test";
  delete env.TIXIAO_DATA_ROOT;

  try {
    const appDataRoot = getAppDataRoot();
    assert.match(appDataRoot, new RegExp(path.join(os.tmpdir(), "tixiao-app-tests").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(getDbFilePath().startsWith(appDataRoot), true);
    assert.equal(getStorageRootPath().startsWith(appDataRoot), true);
  } finally {
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
    if (previousDataRoot === undefined) delete env.TIXIAO_DATA_ROOT;
    else env.TIXIAO_DATA_ROOT = previousDataRoot;
  }
});

test("explicit data root overrides both runtime db and storage paths", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;
  const previousDataRoot = env.TIXIAO_DATA_ROOT;

  env.NODE_ENV = "development";
  env.TIXIAO_DATA_ROOT = "/tmp/tixiao-custom-root";

  try {
    assert.equal(getAppDataRoot(), "/tmp/tixiao-custom-root");
    assert.equal(getDbFilePath(), "/tmp/tixiao-custom-root/db/onion.db");
    assert.equal(getStorageRootPath(), "/tmp/tixiao-custom-root/storage");
  } finally {
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
    if (previousDataRoot === undefined) delete env.TIXIAO_DATA_ROOT;
    else env.TIXIAO_DATA_ROOT = previousDataRoot;
  }
});

test("legacy paths continue pointing at repository db and storage for migration", () => {
  assert.match(getLegacyDbFilePath(), /db\/onion\.db$/);
  assert.match(getLegacyStorageRoot(), /storage$/);
});

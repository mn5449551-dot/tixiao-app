import os from "node:os";
import path from "node:path";

export function getAppDataRoot() {
  if (process.env.TIXIAO_DATA_ROOT) {
    return process.env.TIXIAO_DATA_ROOT;
  }

  if (process.env.NODE_ENV === "test") {
    return path.join(os.tmpdir(), "tixiao-app-tests", `run-${process.pid}`);
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), ".local-data");
}

export function getDbFilePath() {
  return path.join(getAppDataRoot(), "db", "onion.db");
}

export function getStorageRootPath() {
  return path.join(getAppDataRoot(), "storage");
}

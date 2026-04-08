import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { archiveInvalidDatabaseFiles, initializeSqliteConnection, isSqliteDatabaseFile } from "../db";

test("initializeSqliteConnection archives an invalid database file and recreates a valid sqlite database", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tixiao-db-"));
  const tempDbPath = path.join(tempDir, "onion.db");

  fs.writeFileSync(tempDbPath, "not-a-db");
  fs.writeFileSync(`${tempDbPath}-wal`, "bad-wal");
  fs.writeFileSync(`${tempDbPath}-shm`, "bad-shm");

  const archivedPaths = archiveInvalidDatabaseFiles(tempDbPath);
  assert.equal(archivedPaths.length, 3);
  archivedPaths.forEach((archivedPath) => {
    assert.equal(fs.existsSync(archivedPath), true);
  });
  assert.equal(fs.existsSync(tempDbPath), false);

  const connection = initializeSqliteConnection(tempDbPath);
  assert.deepEqual(connection.pragma("journal_mode = WAL"), [{ journal_mode: "wal" }]);
  connection.close();

  assert.equal(isSqliteDatabaseFile(tempDbPath), true);
});

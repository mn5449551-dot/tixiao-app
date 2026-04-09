import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { getDbFilePath, getLegacyDbFilePath } from "@/lib/runtime-paths";
import * as schema from "@/lib/schema";

const SQLITE_HEADER = Buffer.from("SQLite format 3\0");

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function bootstrap(connection: Database.Database) {
  connection.pragma("journal_mode = WAL");
  connection.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requirement_cards (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      raw_input TEXT,
      business_goal TEXT,
      target_audience TEXT,
      format_type TEXT,
      feature TEXT,
      selling_points TEXT,
      time_node TEXT,
      direction_count INTEGER NOT NULL DEFAULT 3,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS directions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      requirement_card_id TEXT NOT NULL,
      title TEXT NOT NULL,
      target_audience TEXT,
      scenario_problem TEXT,
      differentiation TEXT,
      effect TEXT,
      channel TEXT NOT NULL,
      image_form TEXT,
      copy_generation_count INTEGER NOT NULL DEFAULT 3,
      image_text_relation TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_selected INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(requirement_card_id) REFERENCES requirement_cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS copy_cards (
      id TEXT PRIMARY KEY,
      direction_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      image_form TEXT NOT NULL,
      version INTEGER NOT NULL,
      source_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(direction_id) REFERENCES directions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS copies (
      id TEXT PRIMARY KEY,
      copy_card_id TEXT NOT NULL,
      direction_id TEXT NOT NULL,
      title_main TEXT NOT NULL,
      title_sub TEXT,
      title_extra TEXT,
      copy_type TEXT,
      variant_index INTEGER NOT NULL,
      is_locked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(copy_card_id) REFERENCES copy_cards(id) ON DELETE CASCADE,
      FOREIGN KEY(direction_id) REFERENCES directions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS image_configs (
      id TEXT PRIMARY KEY,
      copy_id TEXT NOT NULL UNIQUE,
      direction_id TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL,
      style_mode TEXT NOT NULL,
      ip_role TEXT,
      logo TEXT,
      image_style TEXT NOT NULL,
      reference_image_url TEXT,
      prompt_zh TEXT,
      prompt_en TEXT,
      negative_prompt TEXT,
      count INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(copy_id) REFERENCES copies(id) ON DELETE CASCADE,
      FOREIGN KEY(direction_id) REFERENCES directions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS image_groups (
      id TEXT PRIMARY KEY,
      image_config_id TEXT NOT NULL,
      group_type TEXT NOT NULL,
      variant_index INTEGER NOT NULL,
      slot_count INTEGER NOT NULL,
      aspect_ratio TEXT NOT NULL DEFAULT '1:1',
      style_mode TEXT NOT NULL DEFAULT 'normal',
      image_style TEXT NOT NULL DEFAULT 'realistic',
      is_confirmed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(image_config_id) REFERENCES image_configs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS generated_images (
      id TEXT PRIMARY KEY,
      image_group_id TEXT NOT NULL,
      image_config_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      file_path TEXT,
      file_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      inpaint_parent_id TEXT,
      error_message TEXT,
      seed INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(image_group_id) REFERENCES image_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(image_config_id) REFERENCES image_configs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS export_records (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      target_channels TEXT NOT NULL,
      target_slots TEXT NOT NULL,
      file_format TEXT NOT NULL,
      naming_rule TEXT,
      zip_file_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assistant_states (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      messages TEXT NOT NULL,
      draft TEXT NOT NULL,
      stage TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS canvas_states (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      nodes TEXT,
      edges TEXT,
      viewport TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_generation_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      error_message TEXT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS project_generation_runs_project_status_idx
      ON project_generation_runs(project_id, status);

    CREATE UNIQUE INDEX IF NOT EXISTS project_generation_runs_active_resource_idx
      ON project_generation_runs(project_id, resource_type, resource_id)
      WHERE status = 'running';
  `);

  const directionColumns = connection
    .prepare("PRAGMA table_info(directions)")
    .all() as Array<{ name: string }>;

  if (!directionColumns.some((column) => column.name === "copy_generation_count")) {
    connection.exec(
      "ALTER TABLE directions ADD COLUMN copy_generation_count INTEGER NOT NULL DEFAULT 3;",
    );
  }

  const imageGroupColumns = connection
    .prepare("PRAGMA table_info(image_groups)")
    .all() as Array<{ name: string }>;

  if (!imageGroupColumns.some((column) => column.name === "aspect_ratio")) {
    connection.exec(
      "ALTER TABLE image_groups ADD COLUMN aspect_ratio TEXT NOT NULL DEFAULT '1:1';",
    );
  }

  if (!imageGroupColumns.some((column) => column.name === "style_mode")) {
    connection.exec(
      "ALTER TABLE image_groups ADD COLUMN style_mode TEXT NOT NULL DEFAULT 'normal';",
    );
  }

  if (!imageGroupColumns.some((column) => column.name === "image_style")) {
    connection.exec(
      "ALTER TABLE image_groups ADD COLUMN image_style TEXT NOT NULL DEFAULT 'realistic';",
    );
  }

  const exportRecordColumns = connection
    .prepare("PRAGMA table_info(export_records)")
    .all() as Array<{ name: string }>;

  if (!exportRecordColumns.some((column) => column.name === "target_channels")) {
    connection.exec(
      "ALTER TABLE export_records ADD COLUMN target_channels TEXT NOT NULL DEFAULT '[]';",
    );
  }

  if (!exportRecordColumns.some((column) => column.name === "target_slots")) {
    connection.exec(
      "ALTER TABLE export_records ADD COLUMN target_slots TEXT NOT NULL DEFAULT '[]';",
    );
  }

  if (!exportRecordColumns.some((column) => column.name === "file_format")) {
    connection.exec(
      "ALTER TABLE export_records ADD COLUMN file_format TEXT NOT NULL DEFAULT 'jpg';",
    );
  }

  if (!exportRecordColumns.some((column) => column.name === "naming_rule")) {
    connection.exec(
      "ALTER TABLE export_records ADD COLUMN naming_rule TEXT NOT NULL DEFAULT 'channel_slot_date_version';",
    );
  }

  if (!exportRecordColumns.some((column) => column.name === "zip_file_path")) {
    connection.exec(
      "ALTER TABLE export_records ADD COLUMN zip_file_path TEXT;",
    );
  }
}

export function isSqliteDatabaseFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const stats = fs.statSync(filePath);
  if (stats.size < SQLITE_HEADER.length) {
    return false;
  }

  const fd = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(SQLITE_HEADER.length);
    fs.readSync(fd, header, 0, SQLITE_HEADER.length, 0);
    return header.equals(SQLITE_HEADER);
  } finally {
    fs.closeSync(fd);
  }
}

export function archiveInvalidDatabaseFiles(filePath: string) {
  const archivedPaths: string[] = [];
  const timestamp = Date.now();

  for (const suffix of ["", "-wal", "-shm"]) {
    const currentPath = `${filePath}${suffix}`;
    if (!fs.existsSync(currentPath)) {
      continue;
    }

    const archivedPath = `${currentPath}.invalid-${timestamp}`;
    fs.renameSync(currentPath, archivedPath);
    archivedPaths.push(archivedPath);
  }

  return archivedPaths;
}

function isNotDatabaseError(error: unknown) {
  return error instanceof Error && /file is not a database/i.test(error.message);
}

function checkpointLegacyDatabase(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const legacyConnection = new Database(filePath);
  try {
    legacyConnection.pragma("journal_mode = WAL");
    legacyConnection.pragma("wal_checkpoint(TRUNCATE)");
  } finally {
    legacyConnection.close();
  }
}

function migrateLegacyDatabaseIfNeeded(filePath: string) {
  if (fs.existsSync(filePath)) {
    return;
  }

  const legacyDbPath = getLegacyDbFilePath();
  if (filePath === legacyDbPath || !fs.existsSync(legacyDbPath) || !isSqliteDatabaseFile(legacyDbPath)) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  checkpointLegacyDatabase(legacyDbPath);

  for (const suffix of ["", "-wal", "-shm"]) {
    const sourcePath = `${legacyDbPath}${suffix}`;
    const destinationPath = `${filePath}${suffix}`;
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

export function initializeSqliteConnection(filePath: string = getDbFilePath()) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  migrateLegacyDatabaseIfNeeded(filePath);

  if (fs.existsSync(filePath) && !isSqliteDatabaseFile(filePath)) {
    archiveInvalidDatabaseFiles(filePath);
  }

  let connection = new Database(filePath);
  connection.pragma("foreign_keys = ON");

  try {
    bootstrap(connection);
    return connection;
  } catch (error) {
    connection.close();

    if (isNotDatabaseError(error)) {
      fs.rmSync(`${filePath}-wal`, { force: true });
      fs.rmSync(`${filePath}-shm`, { force: true });

      connection = new Database(filePath);
      connection.pragma("foreign_keys = ON");
      bootstrap(connection);
      return connection;
    }

    throw error;
  }
}

export function getSqlite() {
  if (!sqlite) {
    sqlite = initializeSqliteConnection(getDbFilePath());
  }

  return sqlite;
}

export function getDb() {
  if (!db) {
    db = drizzle(getSqlite(), { schema });
  }

  return db;
}

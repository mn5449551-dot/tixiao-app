import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/schema";

const dbDirectory = path.join(process.cwd(), "db");
const dbFilePath = path.join(dbDirectory, "onion.db");

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let bootstrapped = false;

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
  `);

  const directionColumns = connection
    .prepare("PRAGMA table_info(directions)")
    .all() as Array<{ name: string }>;

  if (!directionColumns.some((column) => column.name === "copy_generation_count")) {
    connection.exec(
      "ALTER TABLE directions ADD COLUMN copy_generation_count INTEGER NOT NULL DEFAULT 3;",
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

export function getSqlite() {
  if (!sqlite) {
    fs.mkdirSync(dbDirectory, { recursive: true });
    sqlite = new Database(dbFilePath);
    sqlite.pragma("foreign_keys = ON");
  }

  if (!bootstrapped) {
    bootstrap(sqlite);
    bootstrapped = true;
  }

  return sqlite;
}

export function getDb() {
  if (!db) {
    db = drizzle(getSqlite(), { schema });
  }

  return db;
}

export { dbFilePath };

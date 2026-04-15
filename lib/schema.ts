import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projectFolders = sqliteTable("project_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  folderId: text("folder_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const requirementCards = sqliteTable(
  "requirement_cards",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    rawInput: text("raw_input"),
    businessGoal: text("business_goal"),
    targetAudience: text("target_audience"),
    formatType: text("format_type"),
    feature: text("feature"),
    sellingPoints: text("selling_points"),
    timeNode: text("time_node"),
    directionCount: integer("direction_count").notNull().default(3),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("requirement_cards_project_id_unique").on(table.projectId)],
);

export const directions = sqliteTable("directions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  requirementCardId: text("requirement_card_id")
    .notNull()
    .references(() => requirementCards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  targetAudience: text("target_audience"),
  adaptationStage: text("adaptation_stage"),
  scenarioProblem: text("scenario_problem"),
  differentiation: text("differentiation"),
  effect: text("effect"),
  channel: text("channel").notNull(),
  imageForm: text("image_form"),
  copyGenerationCount: integer("copy_generation_count").notNull().default(3),
  imageTextRelation: text("image_text_relation"),
  sortOrder: integer("sort_order").notNull().default(0),
  isSelected: integer("is_selected").notNull().default(1),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const copyCards = sqliteTable("copy_cards", {
  id: text("id").primaryKey(),
  directionId: text("direction_id")
    .notNull()
    .references(() => directions.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  imageForm: text("image_form").notNull(),
  version: integer("version").notNull(),
  sourceReason: text("source_reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const copies = sqliteTable("copies", {
  id: text("id").primaryKey(),
  copyCardId: text("copy_card_id")
    .notNull()
    .references(() => copyCards.id, { onDelete: "cascade" }),
  directionId: text("direction_id")
    .notNull()
    .references(() => directions.id, { onDelete: "cascade" }),
  titleMain: text("title_main").notNull(),
  titleSub: text("title_sub"),
  titleExtra: text("title_extra"),
  copyType: text("copy_type"),
  variantIndex: integer("variant_index").notNull(),
  isLocked: integer("is_locked").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const imageConfigs = sqliteTable("image_configs", {
  id: text("id").primaryKey(),
  copyId: text("copy_id")
    .notNull()
    .unique()
    .references(() => copies.id, { onDelete: "cascade" }),
  directionId: text("direction_id")
    .notNull()
    .references(() => directions.id, { onDelete: "cascade" }),
  aspectRatio: text("aspect_ratio").notNull(),
  styleMode: text("style_mode").notNull(),
  ipRole: text("ip_role"),
  logo: text("logo"),
  imageStyle: text("image_style").notNull(),
  referenceImageUrl: text("reference_image_url"),
  ctaEnabled: integer("cta_enabled").notNull().default(0),
  ctaText: text("cta_text"),
  promptBundleJson: text("prompt_bundle_json"),
  count: integer("count").notNull().default(1),
  imageModel: text("image_model"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const imageGroups = sqliteTable("image_groups", {
  id: text("id").primaryKey(),
  imageConfigId: text("image_config_id")
    .notNull()
    .references(() => imageConfigs.id, { onDelete: "cascade" }),
  groupType: text("group_type").notNull(),
  variantIndex: integer("variant_index").notNull(),
  slotCount: integer("slot_count").notNull(),
  aspectRatio: text("aspect_ratio").notNull().default("1:1"),
  styleMode: text("style_mode").notNull().default("normal"),
  imageStyle: text("image_style").notNull().default("realistic"),
  promptBundleJson: text("prompt_bundle_json"),
  referenceImageUrl: text("reference_image_url"),
  logo: text("logo"),
  isConfirmed: integer("is_confirmed").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const generatedImages = sqliteTable("generated_images", {
  id: text("id").primaryKey(),
  imageGroupId: text("image_group_id")
    .notNull()
    .references(() => imageGroups.id, { onDelete: "cascade" }),
  imageConfigId: text("image_config_id")
    .notNull()
    .references(() => imageConfigs.id, { onDelete: "cascade" }),
  slotIndex: integer("slot_index").notNull(),
  filePath: text("file_path"),
  fileUrl: text("file_url"),
  status: text("status").notNull().default("pending"),
  inpaintParentId: text("inpaint_parent_id"),
  errorMessage: text("error_message"),
  finalPromptText: text("final_prompt_text"),
  finalNegativePrompt: text("final_negative_prompt"),
  generationRequestJson: text("generation_request_json"),
  seed: integer("seed"),
  thumbnailPath: text("thumbnail_path"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const exportRecords = sqliteTable("export_records", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  targetChannels: text("target_channels").notNull(),
  targetSlots: text("target_slots").notNull(),
  fileFormat: text("file_format").notNull(),
  namingRule: text("naming_rule").notNull(),
  zipFilePath: text("zip_file_path"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const assistantStates = sqliteTable(
  "assistant_states",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    messages: text("messages").notNull(),
    draft: text("draft").notNull(),
    stage: text("stage").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("assistant_states_project_id_unique").on(table.projectId)],
);

export const canvasStates = sqliteTable(
  "canvas_states",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    nodes: text("nodes"),
    edges: text("edges"),
    viewport: text("viewport"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("canvas_states_project_id_unique").on(table.projectId)],
);

export const projectGenerationRuns = sqliteTable("project_generation_runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  status: text("status").notNull().default("running"),
  errorMessage: text("error_message"),
  startedAt: integer("started_at").notNull(),
  finishedAt: integer("finished_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

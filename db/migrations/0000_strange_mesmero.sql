CREATE TABLE `assistant_states` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`messages` text NOT NULL,
	`draft` text NOT NULL,
	`stage` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assistant_states_project_id_unique` ON `assistant_states` (`project_id`);--> statement-breakpoint
CREATE TABLE `canvas_states` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`nodes` text,
	`edges` text,
	`viewport` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canvas_states_project_id_unique` ON `canvas_states` (`project_id`);--> statement-breakpoint
CREATE TABLE `copies` (
	`id` text PRIMARY KEY NOT NULL,
	`copy_card_id` text NOT NULL,
	`direction_id` text NOT NULL,
	`title_main` text NOT NULL,
	`title_sub` text,
	`title_extra` text,
	`copy_type` text,
	`variant_index` integer NOT NULL,
	`is_locked` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`copy_card_id`) REFERENCES `copy_cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`direction_id`) REFERENCES `directions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `copy_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`direction_id` text NOT NULL,
	`channel` text NOT NULL,
	`image_form` text NOT NULL,
	`version` integer NOT NULL,
	`source_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`direction_id`) REFERENCES `directions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `directions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`requirement_card_id` text NOT NULL,
	`title` text NOT NULL,
	`target_audience` text,
	`scenario_problem` text,
	`differentiation` text,
	`effect` text,
	`channel` text NOT NULL,
	`image_form` text,
	`copy_generation_count` integer DEFAULT 3 NOT NULL,
	`image_text_relation` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_selected` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requirement_card_id`) REFERENCES `requirement_cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `export_records` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`target_channels` text NOT NULL,
	`target_slots` text NOT NULL,
	`file_format` text NOT NULL,
	`naming_rule` text NOT NULL,
	`zip_file_path` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `generated_images` (
	`id` text PRIMARY KEY NOT NULL,
	`image_group_id` text NOT NULL,
	`image_config_id` text NOT NULL,
	`slot_index` integer NOT NULL,
	`file_path` text,
	`file_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`inpaint_parent_id` text,
	`error_message` text,
	`slot_prompt_snapshot` text,
	`slot_negative_prompt` text,
	`reference_plan_snapshot` text,
	`prompt_summary_text` text,
	`seed` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`image_group_id`) REFERENCES `image_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_config_id`) REFERENCES `image_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `image_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`copy_id` text NOT NULL,
	`direction_id` text NOT NULL,
	`aspect_ratio` text NOT NULL,
	`style_mode` text NOT NULL,
	`ip_role` text,
	`logo` text,
	`image_style` text NOT NULL,
	`reference_image_url` text,
	`cta_enabled` integer DEFAULT 0 NOT NULL,
	`cta_text` text,
	`prompt_zh` text,
	`prompt_en` text,
	`negative_prompt` text,
	`count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`copy_id`) REFERENCES `copies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`direction_id`) REFERENCES `directions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `image_configs_copy_id_unique` ON `image_configs` (`copy_id`);--> statement-breakpoint
CREATE TABLE `image_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`image_config_id` text NOT NULL,
	`group_type` text NOT NULL,
	`variant_index` integer NOT NULL,
	`slot_count` integer NOT NULL,
	`aspect_ratio` text DEFAULT '1:1' NOT NULL,
	`style_mode` text DEFAULT 'normal' NOT NULL,
	`image_style` text DEFAULT 'realistic' NOT NULL,
	`prompt_zh` text,
	`prompt_en` text,
	`negative_prompt` text,
	`reference_image_url` text,
	`logo` text,
	`shared_base_snapshot` text,
	`is_confirmed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`image_config_id`) REFERENCES `image_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_generation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`error_message` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `requirement_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`raw_input` text,
	`business_goal` text,
	`target_audience` text,
	`format_type` text,
	`feature` text,
	`selling_points` text,
	`time_node` text,
	`direction_count` integer DEFAULT 3 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requirement_cards_project_id_unique` ON `requirement_cards` (`project_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);

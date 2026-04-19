import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/schema";

const DEFAULT_MODEL_SETTINGS = {
  model_direction: "deepseek-v3-2-251201",
  model_copy: "deepseek-v3-2-251201",
  model_assistant: "deepseek-v3-2-251201",
  model_image_description: "gemini-3.1-pro-preview",
};

export type ModelSettingKey = keyof typeof DEFAULT_MODEL_SETTINGS;

export function getSetting(key: string): string | null {
  const db = getDb();
  const setting = db.select().from(settings).where(eq(settings.key, key)).get();
  return setting?.value ?? null;
}

export function getModelSetting(key: ModelSettingKey): string {
  return getSetting(key) ?? DEFAULT_MODEL_SETTINGS[key];
}

export function getAllModelSettings(): Record<ModelSettingKey, string> {
  const db = getDb();
  const storedSettings = db.select().from(settings).all();

  const result: Record<ModelSettingKey, string> = { ...DEFAULT_MODEL_SETTINGS };
  for (const setting of storedSettings) {
    if (setting.key in DEFAULT_MODEL_SETTINGS) {
      result[setting.key as ModelSettingKey] = setting.value;
    }
  }
  return result;
}

export function upsertSetting(key: string, value: string): boolean {
  const db = getDb();
  const now = Date.now();
  const existing = db.select().from(settings).where(eq(settings.key, key)).get();

  if (existing) {
    return db
      .update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, key))
      .run().changes > 0;
  } else {
    return db
      .insert(settings)
      .values({ key, value, updatedAt: now })
      .run().changes > 0;
  }
}
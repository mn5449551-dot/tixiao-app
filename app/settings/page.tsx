"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";

type ModelSettings = {
  model_direction: string;
  model_copy: string;
  model_assistant: string;
  model_image_description: string;
};

const TEXT_MODEL_OPTIONS = [
  { value: "deepseek-v3-2-251201", label: "DeepSeek V3" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "doubao-seed-2-0-pro", label: "Doubao Seed 2.0 Pro" },
];

const MODEL_CONFIG_LABELS: Record<keyof ModelSettings, string> = {
  model_direction: "方向生成模型",
  model_copy: "文案生成模型",
  model_assistant: "需求助手模型",
  model_image_description: "图片描述模型",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<ModelSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data.settings);
        setIsLoading(false);
      })
      .catch(() => {
        setSaveError("加载配置失败");
        setIsLoading(false);
      });
  }, []);

  const handleChange = useCallback((key: keyof ModelSettings, value: string) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaveSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!settings) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const entries = Object.entries(settings) as Array<[keyof ModelSettings, string]>;
      for (const [key, value] of entries) {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "保存失败");
        }
      }

      setSaveSuccess(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[800px] flex-col gap-8 px-8 py-10">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--brand-200)] border-t-[var(--brand-500)]" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[800px] flex-col gap-8 px-8 py-10">
      <section className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge tone="brand" size="sm">系统设置</Badge>
          <h1 className="text-2xl font-semibold text-[var(--ink-950)]">模型配置</h1>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm">返回首页</Button>
        </Link>
      </section>

      {saveError && (
        <div className="rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-700)]">
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-xl bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success-700)]">
          配置已保存，后续生成将使用新模型
        </div>
      )}

      <Card className="space-y-6 p-6">
        <div>
          <h2 className="mb-4 text-lg font-medium text-[var(--ink-900)]">文本模型配置</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(["model_direction", "model_copy", "model_assistant", "model_image_description"] as const).map((key) => (
              <Field key={key} label={MODEL_CONFIG_LABELS[key]}>
                <Select
                  value={settings?.[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                >
                  {TEXT_MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </div>

        <div className="h-px bg-[var(--line-soft)]" />

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            重置
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "保存中..." : "保存配置"}
          </Button>
        </div>
      </Card>
    </main>
  );
}

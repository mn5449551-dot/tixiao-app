"use client";

import { Field, Select } from "@/components/ui/field";
import { getAspectRatiosForModel, IMAGE_MODELS, IMAGE_STYLES } from "@/lib/constants";

const imageStyleLabel: Record<string, string> = {
  realistic: "写实",
  "3d": "3D",
  animation: "动画",
  felt: "毛毡",
  img2img: "图生图",
};

export function ImageConfigForm({
  channel,
  imageForm,
  aspectRatio,
  styleMode,
  imageStyle,
  imageModel,
  count,
  ctaEnabled,
  ctaText,
  showImageStyleField,
  onAspectRatioChange,
  onStyleModeChange,
  onImageStyleChange,
  onImageModelChange,
  onCountChange,
  onCtaEnabledChange,
  children,
}: {
  channel: string;
  imageForm: string;
  aspectRatio: string;
  styleMode: string;
  imageStyle: string;
  imageModel: string | null;
  count: number;
  ctaEnabled: boolean;
  ctaText: string;
  showImageStyleField: boolean;
  onAspectRatioChange: (value: string) => void;
  onStyleModeChange: (value: string) => void;
  onImageStyleChange: (value: string) => void;
  onImageModelChange: (value: string | null) => void;
  onCountChange: (value: number) => void;
  onCtaEnabledChange: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  const supportsCta = channel === "信息流（广点通）" && imageForm === "single";
  const modelRatios = getAspectRatiosForModel(imageModel);

  return (
    <div className="space-y-2 rounded-[22px] bg-[var(--surface-1)] p-3">
      <Field label="生成模型">
        <Select
          value={imageModel ?? ""}
          onChange={(e) => onImageModelChange(e.target.value || null)}
        >
          <option value="" disabled>请选择模型</option>
          {IMAGE_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="生成比例">
        <Select value={aspectRatio} onChange={(e) => onAspectRatioChange(e.target.value)} disabled={!imageModel}>
          {modelRatios.map((ratio) => (
            <option key={ratio} value={ratio}>
              {ratio}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="风格模式">
        <Select value={styleMode} onChange={(e) => onStyleModeChange(e.target.value)}>
          <option value="normal">普通风格</option>
          <option value="ip">IP 风格</option>
        </Select>
      </Field>

      {showImageStyleField ? (
        <Field label="图片风格">
          <Select value={imageStyle} onChange={(e) => onImageStyleChange(e.target.value)}>
            {IMAGE_STYLES.map((style) => (
              <option key={style} value={style}>
                {imageStyleLabel[style] ?? style}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="生成套数" hint="1-5">
        <input
          type="number"
          min={1}
          max={5}
          value={count}
          onChange={(e) => onCountChange(parseInt(e.target.value, 10))}
          className="h-11 w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3 text-sm text-[var(--ink-900)] outline-none transition placeholder:text-[var(--ink-400)] focus:border-[var(--brand-400)] focus:ring-4 focus:ring-[var(--brand-ring)]"
        />
      </Field>

      {supportsCta ? (
        <Field label="CTA">
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3 py-3 text-sm text-[var(--ink-800)]">
            <input
              type="checkbox"
              checked={ctaEnabled}
              onChange={(e) => onCtaEnabledChange(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand-500)]"
            />
            <span className="font-medium">立即下载</span>
            <span className="text-xs text-[var(--ink-500)]">仅信息流单图生效</span>
          </label>
          {ctaEnabled ? (
            <p className="mt-2 text-xs text-[var(--ink-500)]">将为画面增加 CTA 按钮：{ctaText}</p>
          ) : null}
        </Field>
      ) : null}

      {children}
    </div>
  );
}

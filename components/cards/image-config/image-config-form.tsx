"use client";

import { Field, Select, Textarea } from "@/components/ui/field";
import { ASPECT_RATIOS, IMAGE_STYLES } from "@/lib/constants";

const imageStyleLabel: Record<string, string> = {
  realistic: "写实",
  "3d": "3D",
  animation: "动画",
  felt: "毛毡",
  img2img: "图生图",
};

export function ImageConfigForm({
  aspectRatio,
  styleMode,
  imageStyle,
  count,
  referenceImageUrl,
  isIpMode,
  showImageStyleField,
  onAspectRatioChange,
  onStyleModeChange,
  onImageStyleChange,
  onCountChange,
  onReferenceImageUrlChange,
  children,
}: {
  aspectRatio: string;
  styleMode: string;
  imageStyle: string;
  count: number;
  referenceImageUrl: string;
  isIpMode: boolean;
  showImageStyleField: boolean;
  onAspectRatioChange: (value: string) => void;
  onStyleModeChange: (value: string) => void;
  onImageStyleChange: (value: string) => void;
  onCountChange: (value: number) => void;
  onReferenceImageUrlChange: (value: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-[22px] bg-[var(--surface-1)] p-3">
      <Field label="生成比例">
        <Select value={aspectRatio} onChange={(e) => onAspectRatioChange(e.target.value)}>
          {ASPECT_RATIOS.map((ratio) => (
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

      {!isIpMode && imageStyle === "img2img" ? (
        <Field label="参考图 URL">
          <Textarea
            minRows={1}
            value={referenceImageUrl}
            onChange={(e) => onReferenceImageUrlChange(e.target.value)}
            placeholder="https://..."
          />
        </Field>
      ) : null}

      {children}
    </div>
  );
}

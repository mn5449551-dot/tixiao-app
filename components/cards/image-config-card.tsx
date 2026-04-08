"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { IP_ASSET_OPTIONS } from "@/lib/ip-asset-metadata";
import { LOGO_ASSET_OPTIONS } from "@/lib/logo-asset-metadata";
import {
  resolveImageStyleForMode,
  shouldShowImageStyleField,
  shouldShowIpAssetSelector,
} from "@/lib/workflow-defaults";
import type { CardStatus } from "@/lib/constants";
import { ASPECT_RATIOS, IMAGE_STYLES, LOGO_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

export type ImageConfigCardData = {
  copyId: string;
  copyText: string;
  imageConfigId?: string;
  initialAspectRatio?: string;
  initialStyleMode?: string;
  initialImageStyle?: string;
  initialCount?: number;
  initialLogo?: string;
  initialIpRole?: string | null;
  status?: CardStatus;
};

const imageStyleLabel: Record<string, string> = {
  realistic: "写实",
  "3d": "3D",
  animation: "动画",
  felt: "毛毡",
  img2img: "图生图",
};

export function ImageConfigCard({
  data,
  selected,
}: NodeProps<Node<ImageConfigCardData, "imageConfigCard">>) {
  const { copyId, copyText, status = "idle" } = data;

  const isLoading = status === "loading";
  const isError = status === "error";
  const isDone = status === "done";

  const [aspectRatio, setAspectRatio] = useState(data.initialAspectRatio ?? ASPECT_RATIOS[0]);
  const [styleMode, setStyleMode] = useState(data.initialStyleMode ?? "normal");
  const [imageStyle, setImageStyle] = useState(
    resolveImageStyleForMode(data.initialStyleMode ?? "normal", data.initialImageStyle ?? IMAGE_STYLES[0]),
  );
  const [normalImageStyle, setNormalImageStyle] = useState(
    data.initialStyleMode === "ip"
      ? "realistic"
      : (data.initialImageStyle ?? IMAGE_STYLES[0]),
  );
  const [count, setCount] = useState(data.initialCount ?? 1);
  const [useLogo, setUseLogo] = useState(data.initialLogo !== "none" && data.initialLogo != null);
  const [logoOption, setLogoOption] = useState(data.initialLogo ?? LOGO_OPTIONS[0]);
  const [useIp, setUseIp] = useState(!!data.initialIpRole);
  const [ipRole, setIpRole] = useState<string>(data.initialIpRole ?? IP_ASSET_OPTIONS[0]?.role ?? "");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isIpMode = styleMode === "ip";
  const showImageStyleField = shouldShowImageStyleField(styleMode);
  const showIpAssetSelector = shouldShowIpAssetSelector(styleMode, useIp);
  const activeIp = IP_ASSET_OPTIONS.find((item) => item.role === ipRole) ?? IP_ASSET_OPTIONS[0];

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 5) {
      setCount(val);
    }
  };

  const borderColorClass = isError
    ? "border-[#c0392b]"
    : selected
      ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)]"
      : "border-[var(--line-soft)]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border bg-white p-4 shadow-[var(--shadow-card)] transition",
        borderColorClass,
        isLoading && "ring-2 ring-[var(--brand-ring)]",
      )}
      style={{ width: 340 } satisfies CSSProperties}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[28px] bg-white/60">
          <div className="flex flex-col items-center gap-2">
            <svg className="h-8 w-8 animate-spin text-[var(--brand-500)]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-30" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium text-[var(--brand-600)]">生成中...</span>
          </div>
        </div>
      )}

      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]"
        position={Position.Right}
        type="source"
      />

      {/* Top color bar */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-[4px]",
        isError ? "bg-[#c0392b]" : "bg-[var(--brand-500)]",
      )} />

      {/* Header */}
      <div className="workflow-drag-handle mb-3 flex cursor-grab items-start justify-between gap-3 border-b border-[#f5f0eb] pb-3 pt-1 active:cursor-grabbing">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{"\u25C9"}</span>
            <h3 className="text-sm font-semibold text-[#4a3728]">图片配置</h3>
            {isDone && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#27ae60] text-white text-[10px]">{"\u2713"}</span>
            )}
          </div>
          <p className="line-clamp-1 max-w-[200px] text-[11px] text-[var(--ink-400)]">
            {copyText}
          </p>
        </div>
        <Badge tone="brand">配置</Badge>
      </div>

      {/* Error message */}
      {isError && (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          图片生成失败，请重试
        </div>
      )}
      {submitError ? (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          {submitError}
        </div>
      ) : null}

      {/* Copy text preview */}
      <div className="mb-3 rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-1)] p-3">
        <p className="text-xs leading-relaxed text-[var(--ink-700)]">{copyText}</p>
      </div>

      {/* Config fields */}
      <div className="space-y-2 rounded-[22px] bg-[var(--surface-1)] p-3">
        <Field label="生成比例">
          <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
            {ASPECT_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="风格模式">
          <Select
            value={styleMode}
            onChange={(e) => {
              const nextMode = e.target.value;
              setStyleMode(nextMode);
              if (nextMode === "ip") {
                setUseIp(true);
              }
              setImageStyle(resolveImageStyleForMode(nextMode, normalImageStyle));
            }}
          >
            <option value="normal">普通风格</option>
            <option value="ip">IP 风格</option>
          </Select>
        </Field>

        {showImageStyleField && (
          <Field label="图片风格">
            <Select
              value={imageStyle}
              onChange={(e) => {
                setImageStyle(e.target.value);
                setNormalImageStyle(e.target.value);
              }}
            >
              {IMAGE_STYLES.map((style) => (
                <option key={style} value={style}>
                  {imageStyleLabel[style] ?? style}
                </option>
                ))}
              </Select>
          </Field>
        )}

        <Field label="生成套数" hint="1-5">
          <input
            type="number"
            min={1}
            max={5}
            value={count}
            onChange={handleCountChange}
            className="h-11 w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3 text-sm text-[var(--ink-900)] outline-none transition placeholder:text-[var(--ink-400)] focus:border-[var(--brand-400)] focus:ring-4 focus:ring-[var(--brand-ring)]"
          />
        </Field>

        {!isIpMode && imageStyle === "img2img" && (
          <Field label="参考图 URL">
            <Textarea
              minRows={1}
              value={referenceImageUrl}
              onChange={(e) => setReferenceImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        )}

        {/* Brand elements */}
        <div className="space-y-2 pt-1">
          <span className="text-sm font-medium text-[var(--ink-900)]">品牌元素</span>

          {/* Logo */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useLogo}
              onChange={(e) => setUseLogo(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand-500)]"
            />
            <span className="text-[var(--ink-700)]">Logo</span>
          </label>
          {useLogo && (
            <div className="ml-6 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {LOGO_ASSET_OPTIONS.map((option) => {
                  const isActive = logoOption === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "overflow-hidden rounded-2xl border bg-white text-left transition",
                        isActive
                          ? "border-[var(--brand-400)] ring-2 ring-[var(--brand-ring)]"
                          : "border-[var(--line-soft)] hover:border-[var(--brand-300)]",
                      )}
                      onClick={() => setLogoOption(option.value)}
                    >
                      <div className="relative aspect-[4/3] w-full bg-[var(--surface-2)]">
                        <Image
                          src={option.thumbnailUrl}
                          alt={option.label}
                          fill
                          sizes="140px"
                          className="object-contain"
                        />
                      </div>
                      <div className="space-y-1 px-2 py-2">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-xs font-medium", isActive ? "text-[var(--brand-600)]" : "text-[var(--ink-800)]")}>
                            {option.label}
                          </span>
                          {isActive ? <span className="text-[10px] text-[var(--brand-500)]">已选</span> : null}
                        </div>
                        <p className="line-clamp-2 text-[10px] text-[var(--ink-500)]">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[var(--ink-400)]">（仅导出时叠加）</p>
            </div>
          )}

          {/* IP role */}
          {isIpMode ? (
            <div className="text-sm font-medium text-[var(--ink-900)]">IP 形象</div>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useIp}
                onChange={(e) => setUseIp(e.target.checked)}
                className="h-4 w-4 accent-[var(--brand-500)]"
              />
              <span className="text-[var(--ink-700)]">IP 形象</span>
            </label>
          )}

          {showIpAssetSelector && (
            <div className="ml-6">
              <div className="grid grid-cols-2 gap-2">
                {IP_ASSET_OPTIONS.map((option) => {
                  const isActive = ipRole === option.role;
                  return (
                    <button
                      key={option.role}
                      type="button"
                      className={cn(
                        "overflow-hidden rounded-2xl border bg-white text-left transition",
                        isActive
                          ? "border-[var(--brand-400)] ring-2 ring-[var(--brand-ring)]"
                          : "border-[var(--line-soft)] hover:border-[var(--brand-300)]",
                      )}
                      onClick={() => setIpRole(option.role)}
                    >
                      <div className="relative aspect-[4/3] w-full bg-[var(--surface-2)]">
                        <Image
                          src={option.thumbnailUrl}
                          alt={option.role}
                          fill
                          sizes="160px"
                          className="object-contain"
                        />
                      </div>
                      <div className="space-y-1 px-2 py-2">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-xs font-medium", isActive ? "text-[var(--brand-600)]" : "text-[var(--ink-800)]")}>
                            {option.role}
                          </span>
                          {isActive ? <span className="text-[10px] text-[var(--brand-500)]">已选</span> : null}
                        </div>
                        <p className="line-clamp-2 text-[10px] text-[var(--ink-500)]">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 rounded-2xl border border-[var(--line-soft)] bg-white px-3 py-2">
                <p className="text-[10px] font-medium text-[var(--ink-700)]">角色描述</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-500)]">
                  {activeIp?.description}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Helper text */}
      <p className="mt-3 text-center text-[11px] text-[var(--ink-400)]">
        {showIpAssetSelector
          ? `将使用 ${ipRole} 的 IP 参考图，并在描述中注入角色形象约束`
          : isIpMode
            ? "IP 风格下图片风格自动锁定，若选择 IP 形象将保持角色长相和整体风格一致"
            : "排版、构图、色彩由 AI 自动匹配"}
      </p>

      {/* Divider */}
      <div className="my-3 h-px bg-[var(--line-soft)]" />

      {/* Generate button */}
      <Button
        variant="primary"
        className="w-full text-sm"
        disabled={isSubmitting}
        onClick={async () => {
          setIsSubmitting(true);
          setSubmitError(null);
          try {
            const configResponse = await fetch(`/api/copies/${copyId}/image-config`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                aspect_ratio: aspectRatio,
                style_mode: styleMode,
                ip_role: showIpAssetSelector ? ipRole : null,
                logo: useLogo ? logoOption : "none",
                image_style: resolveImageStyleForMode(styleMode, imageStyle),
                count,
                reference_image_url: showIpAssetSelector ? null : referenceImageUrl || null,
              }),
            });
            if (!configResponse.ok) {
              const payload = (await configResponse.json().catch(() => ({}))) as { error?: string };
              throw new Error(payload.error ?? "图片配置保存失败");
            }

            const payload = (await configResponse.json()) as { id?: string };
            if (!payload.id) {
              throw new Error("图片配置保存失败");
            }

            const generateResponse = await fetch(`/api/image-configs/${payload.id}/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            if (!generateResponse.ok) {
              const payload = (await generateResponse.json().catch(() => ({}))) as { error?: string };
              throw new Error(payload.error ?? "图片生成失败");
            }

            dispatchWorkspaceInvalidated();
          } catch (error) {
            setSubmitError(error instanceof Error ? error.message : "图片生成失败");
          } finally {
            setIsSubmitting(false);
          }
        }}
      >
        {isSubmitting ? "生成中..." : "\u26A1"} 生成候选图（{count}套）
      </Button>
    </div>
  );
}

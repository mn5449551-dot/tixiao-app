"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { saveImageConfigAndGenerate } from "@/components/cards/image-config/image-config-actions";
import { ImageConfigBrandSection } from "@/components/cards/image-config/image-config-brand-section";
import { ImageConfigForm } from "@/components/cards/image-config/image-config-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { IP_ASSET_OPTIONS } from "@/lib/ip-asset-metadata";
import {
  resolveImageStyleForMode,
  shouldShowImageStyleField,
  shouldShowIpAssetSelector,
} from "@/lib/workflow-defaults";
import type { CardStatus } from "@/lib/constants";
import { DEFAULT_IMAGE_MODEL_VALUE, getAspectRatiosForModel, IMAGE_STYLES, LOGO_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

export type ImageConfigCardData = {
  copyId: string;
  copyText: string;
  channel: string;
  imageForm: string;
  imageConfigId?: string;
  initialAspectRatio?: string;
  initialStyleMode?: string;
  initialImageStyle?: string;
  initialImageModel?: string | null;
  initialCount?: number;
  initialLogo?: string;
  initialIpRole?: string | null;
  initialCtaEnabled?: boolean;
  initialCtaText?: string | null;
  status?: CardStatus;
};

export function ImageConfigCard({
  data,
  selected,
}: NodeProps<Node<ImageConfigCardData, "imageConfigCard">>) {
  const { copyId, copyText, status = "idle" } = data;

  const isLoading = status === "loading";
  const isError = status === "error";
  const isDone = status === "done";

  const [aspectRatio, setAspectRatio] = useState(data.initialAspectRatio ?? getAspectRatiosForModel(data.initialImageModel ?? DEFAULT_IMAGE_MODEL_VALUE)[0]);
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
  const [imageModel, setImageModel] = useState<string | null>(data.initialImageModel ?? DEFAULT_IMAGE_MODEL_VALUE);
  const [useLogo, setUseLogo] = useState(data.initialLogo !== "none" && data.initialLogo != null);
  const [logoOption, setLogoOption] = useState(data.initialLogo ?? LOGO_OPTIONS[0]);
  const [useIp, setUseIp] = useState(!!data.initialIpRole);
  const [ipRole, setIpRole] = useState<string>(data.initialIpRole ?? IP_ASSET_OPTIONS[0]?.role ?? "");
  const [ctaEnabled, setCtaEnabled] = useState(Boolean(data.initialCtaEnabled));
  const [ctaText] = useState(data.initialCtaText ?? "立即下载");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isIpMode = styleMode === "ip";
  const supportsCta = data.channel === "信息流（广点通）" && data.imageForm === "single";
  const showImageStyleField = shouldShowImageStyleField(styleMode);
  const showIpAssetSelector = shouldShowIpAssetSelector(styleMode, useIp);
  const activeIp = IP_ASSET_OPTIONS.find((item) => item.role === ipRole) ?? IP_ASSET_OPTIONS[0];

  useEffect(() => {
    if (isSubmitting) return;

    const nextStyleMode = data.initialStyleMode ?? "normal";
    const nextImageStyle = resolveImageStyleForMode(nextStyleMode, data.initialImageStyle ?? IMAGE_STYLES[0]);

    setAspectRatio(data.initialAspectRatio ?? getAspectRatiosForModel(data.initialImageModel ?? DEFAULT_IMAGE_MODEL_VALUE)[0]);
    setStyleMode(nextStyleMode);
    setImageStyle(nextImageStyle);
    setNormalImageStyle(
      nextStyleMode === "ip" ? "realistic" : (data.initialImageStyle ?? IMAGE_STYLES[0]),
    );
    setCount(data.initialCount ?? 1);
    setImageModel(data.initialImageModel ?? DEFAULT_IMAGE_MODEL_VALUE);
    setUseLogo(data.initialLogo !== "none" && data.initialLogo != null);
    setLogoOption(data.initialLogo ?? LOGO_OPTIONS[0]);
    setUseIp(!!data.initialIpRole);
    setIpRole(data.initialIpRole ?? IP_ASSET_OPTIONS[0]?.role ?? "");
    setCtaEnabled(supportsCta ? Boolean(data.initialCtaEnabled) : false);
    setSubmitError(null);
  }, [
    data.initialAspectRatio,
    data.initialCount,
    data.initialImageStyle,
    data.initialImageModel,
    data.initialIpRole,
    data.initialCtaEnabled,
    data.initialLogo,
    data.initialStyleMode,
    isSubmitting,
    supportsCta,
  ]);

  const borderColorClass = isError
    ? "border-[var(--danger-500)]"
    : selected
      ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)]"
      : "border-[var(--line-soft)]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-white p-6 shadow-[var(--shadow-card)] transition-all duration-350 ease-out",
        borderColorClass,
        isLoading && "ring-2 ring-[var(--brand-ring)]",
      )}
      style={{ width: 400, maxWidth: '100%' } satisfies CSSProperties}
    >
      {/* Loading overlay */}
      {(isLoading || isSubmitting) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <span className="text-xs font-medium text-[var(--brand-600)]">{isSubmitting ? "正在生成候选图..." : "生成中..."}</span>
          </div>
        </div>
      )}

      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)] !shadow-sm"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)] !shadow-sm"
        position={Position.Right}
        type="source"
      />

      {/* Top color bar */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-1.5",
        isError ? "bg-[var(--danger-500)]" : "bg-gradient-to-r from-[var(--brand-300)] to-[var(--brand-500)]",
      )} />

      {/* Header */}
      <div className="workflow-drag-handle mb-4 flex cursor-grab items-start justify-between gap-3 border-b border-[var(--line-soft)] pb-4 active:cursor-grabbing">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-[var(--ink-950)]">图片配置</h3>
            {isDone && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--success-500)] text-[10px] text-white shadow-sm">
                ✓
              </span>
            )}
            {isError && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--danger-500)] text-[10px] text-white shadow-sm">
                ✕
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 max-w-[260px] text-xs text-[var(--ink-500)]" title={copyText}>
            {copyText}
          </p>
        </div>
        <Badge tone="brand" size="sm" className="shrink-0">配置</Badge>
      </div>

      {/* Error message */}
      {isError && (
        <div className="mb-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-700)]">
          图片生成失败，请重试
        </div>
      )}
      {submitError ? (
        <div className="mb-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-700)]">
          {submitError}
        </div>
      ) : null}

      {/* Copy text preview */}
      <div className="mb-4 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-1)] p-4">
        <p className="text-xs leading-relaxed text-[var(--ink-700)]">{copyText}</p>
      </div>

      <ImageConfigForm
        channel={data.channel}
        imageForm={data.imageForm}
        aspectRatio={aspectRatio}
        styleMode={styleMode}
        imageStyle={imageStyle}
        imageModel={imageModel}
        count={count}
        ctaEnabled={supportsCta ? ctaEnabled : false}
        ctaText={ctaText}
        showImageStyleField={showImageStyleField}
        onAspectRatioChange={setAspectRatio}
        onStyleModeChange={(nextMode) => {
          setStyleMode(nextMode);
          if (nextMode === "ip") {
            setUseIp(true);
          }
          setImageStyle(resolveImageStyleForMode(nextMode, normalImageStyle));
        }}
        onImageStyleChange={(value) => {
          setImageStyle(value);
          setNormalImageStyle(value);
        }}
        onImageModelChange={(newModel) => {
          setImageModel(newModel);
          const newRatios = getAspectRatiosForModel(newModel);
          if (newRatios.length > 0 && !newRatios.includes(aspectRatio)) {
            setAspectRatio(newRatios[0]);
          }
        }}
        onCountChange={(value) => {
          if (!isNaN(value) && value >= 1 && value <= 5) {
            setCount(value);
          }
        }}
        onCtaEnabledChange={setCtaEnabled}
      >
        <ImageConfigBrandSection
          useLogo={useLogo}
          logoOption={logoOption}
          ipRole={ipRole}
          isIpMode={isIpMode}
          showIpAssetSelector={showIpAssetSelector}
          activeIpDescription={activeIp?.description}
          onUseLogoChange={setUseLogo}
          onLogoOptionChange={setLogoOption}
          onIpRoleChange={setIpRole}
        />
      </ImageConfigForm>

      {/* Helper text */}
      <div className="mt-4 rounded-2xl bg-[var(--surface-1)] px-4 py-3">
        <p className="text-center text-[11px] text-[var(--ink-600)]">
          {showIpAssetSelector
            ? `将使用 ${ipRole} 的 IP 参考图，并在描述中注入角色形象约束`
            : isIpMode
              ? "IP 风格下图片风格自动锁定，若选择 IP 形象将保持角色长相和整体风格一致"
              : "排版、构图、色彩由 AI 自动匹配"}
        </p>
      </div>

      {/* Divider */}
      <div className="my-4 h-px bg-[var(--line-soft)]" />

      {/* Generate button */}
      <Button
        variant="primary"
        className="w-full py-3.5 text-sm font-semibold shadow-[var(--shadow-brand)] hover:shadow-[var(--shadow-brand-hover)]"
        disabled={isSubmitting}
        onClick={async () => {
          setIsSubmitting(true);
          setSubmitError(null);
          try {
            const result = await saveImageConfigAndGenerate({
              copyId,
              imageConfigId: data.imageConfigId,
              aspectRatio,
              styleMode,
              imageStyle: resolveImageStyleForMode(styleMode, imageStyle),
              imageModel,
              count,
              logo: useLogo ? logoOption : "none",
              ipRole: showIpAssetSelector ? ipRole : null,
              referenceImageUrl: null,
              ctaEnabled: supportsCta ? ctaEnabled : false,
              ctaText: supportsCta ? ctaText : null,
            });
            if (!result.ok) {
              if (result.configSaved) {
                dispatchWorkspaceInvalidated();
              }
              throw new Error(result.error ?? "图片生成失败");
            }

            dispatchWorkspaceInvalidated();
          } catch (error) {
            setSubmitError(error instanceof Error ? error.message : "图片生成失败");
          } finally {
            setIsSubmitting(false);
          }
        }}
      >
        {isSubmitting ? (
          <><span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-white" /> 生成中...</>
        ) : (
          <><span className="mr-2">⚡</span> 生成候选图（{count}套）</>
        )}
      </Button>
    </div>
  );
}

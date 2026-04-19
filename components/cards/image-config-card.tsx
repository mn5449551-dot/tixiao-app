"use client";

import type { CSSProperties, ReactElement } from "react";
import { useEffect, useRef, useState } from "react";

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
import { DEFAULT_IMAGE_MODEL_VALUE, getAspectRatiosForModel, IMAGE_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ApiError, apiFetch } from "@/lib/api-fetch";
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

function getInitialNormalImageStyle(
  styleMode: string | undefined,
  imageStyle: string | undefined,
): string {
  if (styleMode === "ip") {
    return "realistic";
  }

  return imageStyle ?? IMAGE_STYLES[0];
}

export function ImageConfigCard({
  data,
  selected,
}: NodeProps<Node<ImageConfigCardData, "imageConfigCard">>): ReactElement {
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
    getInitialNormalImageStyle(data.initialStyleMode, data.initialImageStyle),
  );
  const [count, setCount] = useState(data.initialCount ?? 1);
  const [imageModel, setImageModel] = useState<string | null>(data.initialImageModel ?? DEFAULT_IMAGE_MODEL_VALUE);
  const [useIp, setUseIp] = useState(!!data.initialIpRole);
  const [ipRole, setIpRole] = useState<string>(data.initialIpRole ?? IP_ASSET_OPTIONS[0]?.role ?? "");
  const [ctaEnabled, setCtaEnabled] = useState(Boolean(data.initialCtaEnabled));
  const [ctaText, setCtaText] = useState(data.initialCtaText ?? "立即下载");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isIpMode = styleMode === "ip";
  const supportsCta = data.channel === "信息流（广点通）" && data.imageForm === "single";
  const showImageStyleField = shouldShowImageStyleField(styleMode);
  const showIpAssetSelector = shouldShowIpAssetSelector(styleMode, useIp);

  const initialDataRef = useRef({
    initialAspectRatio: data.initialAspectRatio,
    initialStyleMode: data.initialStyleMode,
    initialImageStyle: data.initialImageStyle,
    initialImageModel: data.initialImageModel,
    initialCount: data.initialCount,
    initialIpRole: data.initialIpRole,
    initialCtaEnabled: data.initialCtaEnabled,
  });

  useEffect(() => {
    const refData = initialDataRef.current;
    const changed =
      data.initialAspectRatio !== refData.initialAspectRatio ||
      data.initialStyleMode !== refData.initialStyleMode ||
      data.initialImageStyle !== refData.initialImageStyle ||
      data.initialImageModel !== refData.initialImageModel ||
      data.initialCount !== refData.initialCount ||
      data.initialIpRole !== refData.initialIpRole ||
      data.initialCtaEnabled !== refData.initialCtaEnabled;

    if (!changed) return;

    const nextStyleMode = data.initialStyleMode ?? "normal";
    const nextImageStyle = resolveImageStyleForMode(nextStyleMode, data.initialImageStyle ?? IMAGE_STYLES[0]);

    setAspectRatio(data.initialAspectRatio ?? getAspectRatiosForModel(data.initialImageModel ?? DEFAULT_IMAGE_MODEL_VALUE)[0]);
    setStyleMode(nextStyleMode);
    setImageStyle(nextImageStyle);
    setNormalImageStyle(getInitialNormalImageStyle(nextStyleMode, data.initialImageStyle));
    setCount(data.initialCount ?? 1);
    setImageModel(data.initialImageModel ?? DEFAULT_IMAGE_MODEL_VALUE);
    setUseIp(!!data.initialIpRole);
    setIpRole(data.initialIpRole ?? IP_ASSET_OPTIONS[0]?.role ?? "");
    setCtaEnabled(supportsCta ? Boolean(data.initialCtaEnabled) : false);
    setCtaText(data.initialCtaText ?? "立即下载");
    setSubmitError(null);

    initialDataRef.current = {
      initialAspectRatio: data.initialAspectRatio,
      initialStyleMode: data.initialStyleMode,
      initialImageStyle: data.initialImageStyle,
      initialImageModel: data.initialImageModel,
      initialCount: data.initialCount,
      initialIpRole: data.initialIpRole,
      initialCtaEnabled: data.initialCtaEnabled,
    };
  }, [
    data.initialAspectRatio,
    data.initialStyleMode,
    data.initialImageStyle,
    data.initialImageModel,
    data.initialCount,
    data.initialIpRole,
    data.initialCtaEnabled,
    supportsCta,
  ]);

  const borderColorClass = isError
    ? "border-[var(--danger)]"
    : selected
      ? "border-[var(--brand-light)] ring-2 ring-[var(--brand-ring)]"
      : "border-[var(--border)]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition-all duration-[var(--duration-normal)] ease-out",
        borderColorClass,
        isLoading && "ring-2 ring-[var(--brand-ring)]",
      )}
      style={{ width: 400, maxWidth: '100%' } satisfies CSSProperties}
    >
      {/* Loading overlay */}
      {(isLoading || isSubmitting) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-lg)] bg-white/70">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="md" />
            <span className="text-xs font-medium text-[var(--brand-hover)]">{isSubmitting ? "正在生成候选图..." : "生成中..."}</span>
          </div>
        </div>
      )}

      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand)]"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand)]"
        position={Position.Right}
        type="source"
      />

      {/* Top color bar */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-1",
        isError ? "bg-[var(--danger)]" : "bg-[var(--brand)]",
      )} />

      {/* Header */}
      <div className="workflow-drag-handle mb-4 flex cursor-grab items-start justify-between gap-3 border-b border-[var(--border)] pb-3 active:cursor-grabbing">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-[var(--ink-strong)]">图片配置</h3>
            {isDone && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--success)] text-xs text-white shadow-sm">
                ✓
              </span>
            )}
            {isError && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--danger)] text-xs text-white shadow-sm">
                ✕
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 max-w-[260px] text-xs text-[var(--ink-muted)]" title={copyText}>
            {copyText}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone="brand" size="sm">配置</Badge>
          {isDone && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success)] text-xs text-white">✓</span>
          )}
          {isError && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger)] text-xs text-white">✕</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[var(--ink-muted)] hover:text-[var(--danger-text)]"
            disabled={!data.imageConfigId || isDeleting}
            onClick={async () => {
              if (!data.imageConfigId || isDeleting) return;
              if (!confirm("确定删除图片配置卡？关联的候选图也会一起删除。")) return;
              setIsDeleting(true);
              setSubmitError(null);
              try {
                await apiFetch(`/api/image-configs/${data.imageConfigId}`, { method: "DELETE" });
                dispatchWorkspaceInvalidated();
              } catch (error) {
                setSubmitError(error instanceof Error ? error.message : "删除失败");
              } finally {
                setIsDeleting(false);
              }
            }}
            title={!data.imageConfigId ? "未保存" : "删除图片配置卡"}
          >
            {isDeleting ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--ink-subtle)] border-t-[var(--ink-muted)]" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </Button>
        </div>
      </div>

      {/* Error message */}
      {isError && (
        <div className="mb-3 rounded-lg bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">
          图片生成失败，请重试
        </div>
      )}
      {submitError ? (
        <div className="mb-3 rounded-lg bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">
          {submitError}
        </div>
      ) : null}

      {/* Copy text preview */}
      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-dim)] p-4">
        <p className="text-xs leading-relaxed text-[var(--ink-default)]">{copyText}</p>
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
        onCtaTextChange={setCtaText}
      >
        <ImageConfigBrandSection
          ipRole={ipRole}
          isIpMode={isIpMode}
          showIpAssetSelector={showIpAssetSelector}
          onIpRoleChange={setIpRole}
        />
      </ImageConfigForm>

      {/* Helper text */}
      <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--surface-dim)] px-4 py-3">
        <p className="text-center text-xs text-[var(--ink-subtle)]">
          {showIpAssetSelector
            ? `将使用 ${ipRole} 的 IP 参考图，并在描述中注入角色形象约束`
            : isIpMode
              ? "IP 风格下图片风格自动锁定，若选择 IP 形象将保持角色长相和整体风格一致"
              : "排版、构图、色彩由 AI 自动匹配"}
        </p>
      </div>

      {/* Divider */}
      <div className="my-4 h-px bg-[var(--border)]" />

      {/* Generate button */}
      <Button
        variant="primary"
        className="w-full py-3.5 text-sm font-semibold"
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
              ipRole: showIpAssetSelector ? ipRole : null,
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

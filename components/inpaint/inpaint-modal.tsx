"use client";

import type { ReactPortal } from "react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/field";
import { useInpaintCanvas } from "@/components/inpaint/use-inpaint-canvas";
import { useInpaintGeneration } from "@/components/inpaint/use-inpaint-generation";
import { getInpaintTabClass } from "@/components/inpaint/inpaint-utils";
import { IMAGE_MODELS } from "@/lib/constants";

interface InpaintModalProps {
  imageId: string;
  imageUrl: string | null;
  imageModel?: string | null;
  onClose: () => void;
}

export function InpaintModal({ imageId, imageUrl, imageModel, onClose }: InpaintModalProps): ReactPortal {
  const [activeTab, setActiveTab] = useState<"text" | "area">("text");

  const modelSupportsEdits = useMemo(() => {
    if (!imageModel) return true;
    return IMAGE_MODELS.find((m) => m.value === imageModel)?.supportsEdits ?? false;
  }, [imageModel]);

  const modelLabel = useMemo(() => {
    if (!imageModel) return "";
    return IMAGE_MODELS.find((m) => m.value === imageModel)?.label ?? imageModel;
  }, [imageModel]);

  const {
    copyLoading,
    editedTitleMain,
    editedTitleSub,
    editedTitleExtra,
    instruction,
    generating,
    result,
    error,
    setEditedTitleMain,
    setEditedTitleSub,
    setEditedTitleExtra,
    setInstruction,
    handleTextGenerate,
    handleAreaGenerate,
    handleAdopt,
    handleDiscard,
    dismissResult,
  } = useInpaintGeneration({
    imageId,
    imageModel,
    onClose,
  });

  const {
    canvasRef,
    maskCanvasRef,
    brushSize,
    zoom,
    panOffset,
    spaceHeld,
    strokeHistory,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleUndo,
    handleClearMask,
    handleWheel,
    handleDoubleClick,
    handleImageLoad,
    setBrushSize,
    createMaskDataUrl,
  } = useInpaintCanvas({
    activeTab,
    modelSupportsEdits,
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex bg-black/90">
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-black"
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="relative"
          style={{
            transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: "center center",
          }}
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="编辑图片"
              className="block max-h-[90vh] max-w-[70vw] object-contain"
              onLoad={handleImageLoad}
            />
          )}
          {activeTab === "area" && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{
                width: "100%",
                height: "100%",
                cursor: spaceHeld ? "grab" : "crosshair",
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
          )}
        </div>

        <canvas ref={maskCanvasRef} className="hidden" />

        <div className="absolute bottom-4 left-4 rounded bg-black/50 px-2 py-1 text-xs text-white/70">
          {Math.round(zoom * 100)}%
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
          title="关闭 (ESC)"
        >
          ✕
        </button>
      </div>

      <div className="flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#1a1a1a]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">局部重绘</h2>
          <p className="mt-1 text-xs text-white/50">
            {modelLabel ? `当前模型：${modelLabel}` : "编辑图中文字或框选区域进行重绘"}
          </p>
        </div>

        {!modelSupportsEdits && (
          <div className="mx-4 mt-4 rounded-lg bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            当前模型不支持局部重绘，请选择即梦或通义千问系列模型。
          </div>
        )}

        <div className="flex border-b border-white/10">
          <button
            type="button"
            className={`flex-1 px-4 py-3 text-xs font-medium transition ${getInpaintTabClass(activeTab === "text")}`}
            onClick={() => setActiveTab("text")}
          >
            文字重绘
          </button>
          <button
            type="button"
            className={`flex-1 px-4 py-3 text-xs font-medium transition ${getInpaintTabClass(activeTab === "area")}`}
            onClick={() => setActiveTab("area")}
          >
            框选重绘
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "text" && (
            <div className="space-y-4">
              {copyLoading ? (
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Spinner size="sm" /> 加载文案中...
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">主标题</label>
                    <Textarea
                      minRows={1}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30"
                      placeholder="输入主标题"
                      value={editedTitleMain}
                      onChange={(e) => setEditedTitleMain(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">副标题</label>
                    <Textarea
                      minRows={1}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30"
                      placeholder="输入副标题"
                      value={editedTitleSub}
                      onChange={(e) => setEditedTitleSub(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">补充文字</label>
                    <Textarea
                      minRows={1}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30"
                      placeholder="输入补充文字"
                      value={editedTitleExtra}
                      onChange={(e) => setEditedTitleExtra(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="primary"
                    className="w-full text-xs"
                    disabled={generating || !modelSupportsEdits}
                    onClick={() => void handleTextGenerate()}
                  >
                    {generating ? "生成中..." : "生成重绘"}
                  </Button>
                </>
              )}
            </div>
          )}

          {activeTab === "area" && (
            <div className="space-y-4">
              {!modelSupportsEdits ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center text-xs text-amber-300">
                  当前模型不支持框选重绘
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-white/70">画笔大小</label>
                      <span className="text-xs text-white/50">{brushSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1 text-xs text-white/70"
                        onClick={handleUndo}
                        disabled={strokeHistory.length === 0}
                      >
                        撤销
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex-1 text-xs text-white/70"
                        onClick={handleClearMask}
                        disabled={strokeHistory.length === 0}
                      >
                        清除
                      </Button>
                    </div>
                    <p className="text-xs text-white/40">
                      在图片上涂抹标记重绘区域。按住空格拖拽平移，滚轮缩放。
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">重绘指令</label>
                    <Textarea
                      minRows={3}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30"
                      placeholder="描述你要重绘的内容，例如：把蓝衣服的人换成红衣服的"
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="primary"
                    className="w-full text-xs"
                    disabled={generating || !modelSupportsEdits || strokeHistory.length === 0 || !instruction.trim()}
                    onClick={() =>
                      void handleAreaGenerate({
                        hasMask: strokeHistory.length > 0,
                        maskDataUrl: createMaskDataUrl(),
                      })
                    }
                  >
                    {generating ? "生成中..." : "生成重绘"}
                  </Button>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {result && result.status === "generating" && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <Spinner size="sm" />
                <span className="text-sm text-white/70">重绘生成中...</span>
              </div>
            </div>
          )}

          {result && result.status === "done" && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-medium text-white">重绘完成</h3>
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1 text-xs" onClick={handleAdopt}>
                  采纳
                </Button>
                <Button variant="secondary" className="text-xs" onClick={() => void handleDiscard()}>
                  放弃
                </Button>
              </div>
            </div>
          )}

          {result && result.status === "failed" && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-300">重绘失败，请重试</p>
              <Button variant="secondary" className="mt-2 text-xs" onClick={dismissResult}>
                关闭
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

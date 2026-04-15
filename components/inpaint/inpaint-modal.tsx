"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/field";
import { IMAGE_MODELS } from "@/lib/constants";

interface InpaintModalProps {
  imageId: string;
  imageUrl: string | null;
  imageModel?: string | null;
  onClose: () => void;
}

type CopyData = {
  titleMain: string | null;
  titleSub: string | null;
  titleExtra: string | null;
};

type InpaintResult = {
  imageId: string;
  status: "generating" | "done" | "failed";
} | null;

export function InpaintModal({ imageId, imageUrl, imageModel, onClose }: InpaintModalProps) {
  const [activeTab, setActiveTab] = useState<"text" | "area">("text");
  const [copyLoading, setCopyLoading] = useState(false);
  const [editedTitleMain, setEditedTitleMain] = useState("");
  const [editedTitleSub, setEditedTitleSub] = useState("");
  const [editedTitleExtra, setEditedTitleExtra] = useState("");
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<InpaintResult>(null);
  const [error, setError] = useState<string | null>(null);

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageElRef = useRef<HTMLImageElement | null>(null);
  const [brushSize, setBrushSize] = useState(30);
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [strokeHistory, setStrokeHistory] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modelSupportsEdits = useMemo(() => {
    if (!imageModel) return true;
    return IMAGE_MODELS.find((m) => m.value === imageModel)?.supportsEdits ?? false;
  }, [imageModel]);

  const modelLabel = useMemo(() => {
    if (!imageModel) return "";
    return IMAGE_MODELS.find((m) => m.value === imageModel)?.label ?? imageModel;
  }, [imageModel]);

  // Fetch copy data on mount
  useEffect(() => {
    let cancelled = false;
    setCopyLoading(true);
    fetch(`/api/images/${imageId}/copy`)
      .then((res) => res.json())
      .then((data: CopyData) => {
        if (cancelled) return;
        setEditedTitleMain(data.titleMain ?? "");
        setEditedTitleSub(data.titleSub ?? "");
        setEditedTitleExtra(data.titleExtra ?? "");
      })
      .catch(() => {
        // Copy fetch failed, leave fields empty
      })
      .finally(() => {
        if (!cancelled) setCopyLoading(false);
      });
    return () => { cancelled = true; };
  }, [imageId]);

  // ESC to close, space for pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [onClose]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const pollForResult = useCallback((resultImageId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/images/${resultImageId}`);
        if (!res.ok) return;
        const data = await res.json() as { status: string };
        if (data.status === "done" || data.status === "failed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setResult({ imageId: resultImageId, status: data.status });
        }
      } catch {
        // Keep polling
      }
    }, 2000);
  }, []);

  const handleTextGenerate = useCallback(async () => {
    const parts: string[] = [];
    if (editedTitleMain.trim()) parts.push(`主标题「${editedTitleMain.trim()}」`);
    if (editedTitleSub.trim()) parts.push(`副标题「${editedTitleSub.trim()}」`);
    if (editedTitleExtra.trim()) parts.push(`补充文字「${editedTitleExtra.trim()}」`);
    if (parts.length === 0) {
      setError("请至少填写一项文案");
      return;
    }
    const prompt = `请将图片中的文字替换为：${parts.join("，")}。保持图片其他部分不变，仅修改文字内容和排版。`;

    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/images/${imageId}/inpaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inpaint_instruction: prompt, image_model: imageModel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "生成失败");
        return;
      }
      const data = await res.json() as { imageId: string; status: string };
      setResult({ imageId: data.imageId, status: "generating" });
      pollForResult(data.imageId);
    } catch {
      setError("网络错误");
    } finally {
      setGenerating(false);
    }
  }, [editedTitleMain, editedTitleSub, editedTitleExtra, imageId, imageModel, pollForResult]);

  // Canvas helpers
  const screenToImage = useCallback((clientX: number, clientY: number) => {
    const img = imageElRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = rect.width / rect.height;
    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (canvasAspect > imgAspect) {
      renderH = rect.height;
      renderW = renderH * imgAspect;
      offsetX = (rect.width - renderW) / 2;
      offsetY = 0;
    } else {
      renderW = rect.width;
      renderH = renderW / imgAspect;
      offsetX = 0;
      offsetY = (rect.height - renderH) / 2;
    }
    const displayX = ((clientX - rect.left - offsetX) / zoom) - panOffset.x;
    const displayY = ((clientY - rect.top - offsetY) / zoom) - panOffset.y;
    const imgX = (displayX / renderW) * img.naturalWidth;
    const imgY = (displayY / renderH) * img.naturalHeight;
    return { x: imgX, y: imgY };
  }, [zoom, panOffset]);

  const drawStrokeOnMask = useCallback((stroke: Array<{ x: number; y: number }>, size: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || stroke.length === 0) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "white";
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }
    ctx.stroke();

    // Also draw on the visible overlay canvas for user feedback
    const overlayCanvas = canvasRef.current;
    if (!overlayCanvas) return;
    const octx = overlayCanvas.getContext("2d");
    if (!octx) return;
    const scaleX = overlayCanvas.width / maskCanvas.width;
    const scaleY = overlayCanvas.height / maskCanvas.height;
    octx.strokeStyle = "rgba(255, 80, 80, 0.6)";
    octx.lineWidth = size * Math.min(scaleX, scaleY);
    octx.lineCap = "round";
    octx.lineJoin = "round";
    octx.beginPath();
    octx.moveTo(stroke[0].x * scaleX, stroke[0].y * scaleY);
    for (let i = 1; i < stroke.length; i++) {
      octx.lineTo(stroke[i].x * scaleX, stroke[i].y * scaleY);
    }
    octx.stroke();
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!modelSupportsEdits) return;
    if (spaceHeld || activeTab !== "area") {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y };
      return;
    }
    const pt = screenToImage(e.clientX, e.clientY);
    setIsDrawing(true);
    setCurrentStroke([pt]);
  }, [activeTab, spaceHeld, screenToImage, modelSupportsEdits, panOffset]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = (e.clientX - panStartRef.current.x) / zoom;
      const dy = (e.clientY - panStartRef.current.y) / zoom;
      setPanOffset({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      return;
    }
    if (!isDrawing) return;
    const pt = screenToImage(e.clientX, e.clientY);
    setCurrentStroke((prev) => [...prev, pt]);
  }, [isPanning, isDrawing, screenToImage, zoom]);

  const handleCanvasMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (isDrawing && currentStroke.length > 0) {
      drawStrokeOnMask(currentStroke, brushSize);
      setStrokeHistory((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
    setIsDrawing(false);
  }, [isPanning, isDrawing, currentStroke, drawStrokeOnMask, brushSize]);

  const handleUndo = useCallback(() => {
    setStrokeHistory((prev) => {
      const next = prev.slice(0, -1);
      const maskCanvas = maskCanvasRef.current;
      const overlayCanvas = canvasRef.current;
      if (maskCanvas) {
        const ctx = maskCanvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
      if (overlayCanvas) {
        const octx = overlayCanvas.getContext("2d");
        if (octx) octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
      for (const stroke of next) {
        drawStrokeOnMask(stroke, brushSize);
      }
      return next;
    });
  }, [drawStrokeOnMask, brushSize]);

  const handleClearMask = useCallback(() => {
    setStrokeHistory([]);
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = canvasRef.current;
    if (maskCanvas) {
      const ctx = maskCanvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
    if (overlayCanvas) {
      const octx = overlayCanvas.getContext("2d");
      if (octx) octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
  }, []);

  const handleAreaGenerate = useCallback(async () => {
    const maskCanvas = maskCanvasRef.current;
    const img = imageElRef.current;
    if (!maskCanvas || !img) return;

    if (strokeHistory.length === 0) {
      setError("请在图片上涂抹标记重绘区域");
      return;
    }
    if (!instruction.trim()) {
      setError("请输入重绘指令");
      return;
    }

    const offscreen = document.createElement("canvas");
    offscreen.width = img.naturalWidth;
    offscreen.height = img.naturalHeight;
    const ctx = offscreen.getContext("2d")!;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.strokeStyle = "white";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokeHistory) {
      if (stroke.length === 0) continue;
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
    const maskDataUrl = offscreen.toDataURL("image/png");

    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/images/${imageId}/inpaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mask_data_url: maskDataUrl,
          inpaint_instruction: instruction,
          image_model: imageModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "生成失败");
        return;
      }
      const data = await res.json() as { imageId: string; status: string };
      setResult({ imageId: data.imageId, status: "generating" });
      pollForResult(data.imageId);
    } catch {
      setError("网络错误");
    } finally {
      setGenerating(false);
    }
  }, [brushSize, strokeHistory, instruction, imageId, imageModel, pollForResult]);

  const handleAdopt = useCallback(() => {
    setResult(null);
    onClose();
  }, [onClose]);

  const handleDiscard = useCallback(async () => {
    if (!result?.imageId) return;
    try {
      await fetch(`/api/images/${result.imageId}`, { method: "DELETE" });
    } catch {
      // Ignore delete errors
    }
    setResult(null);
  }, [result]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.25, Math.min(4, prev - e.deltaY * 0.001)));
  }, []);

  const handleDoubleClick = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex bg-black/90">
      {/* Image canvas area */}
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
              ref={imageElRef}
              src={imageUrl}
              alt="编辑图片"
              className="block max-h-[90vh] max-w-[70vw] object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                imageElRef.current = img;
                const maskCanvas = maskCanvasRef.current;
                if (maskCanvas) {
                  maskCanvas.width = img.naturalWidth;
                  maskCanvas.height = img.naturalHeight;
                }
                // Sync overlay canvas pixel size to its display size
                requestAnimationFrame(() => {
                  const overlayCanvas = canvasRef.current;
                  if (overlayCanvas) {
                    overlayCanvas.width = overlayCanvas.offsetWidth;
                    overlayCanvas.height = overlayCanvas.offsetHeight;
                  }
                });
              }}
            />
          )}
          {/* Mask canvas overlay */}
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
        {/* Hidden mask canvas at original image resolution */}
        <canvas ref={maskCanvasRef} className="hidden" />
        {/* Zoom indicator */}
        <div className="absolute bottom-4 left-4 rounded bg-black/50 px-2 py-1 text-xs text-white/70">
          {Math.round(zoom * 100)}%
        </div>
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
          title="关闭 (ESC)"
        >
          ✕
        </button>
      </div>

      {/* Right panel */}
      <div className="flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#1a1a1a]">
        {/* Header */}
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">局部重绘</h2>
          <p className="mt-1 text-xs text-white/50">
            {modelLabel ? `当前模型：${modelLabel}` : "编辑图中文字或框选区域进行重绘"}
          </p>
        </div>

        {/* Model warning */}
        {!modelSupportsEdits && (
          <div className="mx-4 mt-4 rounded-lg bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            当前模型不支持局部重绘，请选择即梦或通义千问系列模型。
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-b border-white/10">
          <button
            type="button"
            className={`flex-1 px-4 py-3 text-xs font-medium transition ${
              activeTab === "text"
                ? "border-b-2 border-white text-white"
                : "text-white/40 hover:text-white/70"
            }`}
            onClick={() => setActiveTab("text")}
          >
            文字重绘
          </button>
          <button
            type="button"
            className={`flex-1 px-4 py-3 text-xs font-medium transition ${
              activeTab === "area"
                ? "border-b-2 border-white text-white"
                : "text-white/40 hover:text-white/70"
            }`}
            onClick={() => setActiveTab("area")}
          >
            框选重绘
          </button>
        </div>

        {/* Tab content */}
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
                    onClick={handleTextGenerate}
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
                      <Button variant="ghost" className="flex-1 text-xs text-white/70" onClick={handleUndo} disabled={strokeHistory.length === 0}>
                        撤销
                      </Button>
                      <Button variant="ghost" className="flex-1 text-xs text-white/70" onClick={handleClearMask} disabled={strokeHistory.length === 0}>
                        清除
                      </Button>
                    </div>
                    <p className="text-[10px] text-white/40">
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
                    onClick={handleAreaGenerate}
                  >
                    {generating ? "生成中..." : "生成重绘"}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Result */}
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
                <Button variant="secondary" className="text-xs" onClick={handleDiscard}>
                  放弃
                </Button>
              </div>
            </div>
          )}

          {result && result.status === "failed" && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-300">重绘失败，请重试</p>
              <Button variant="secondary" className="mt-2 text-xs" onClick={() => setResult(null)}>
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

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const VIEWER_PADDING_X = 96;
const VIEWER_PADDING_Y = 168;
const MAX_INITIAL_UPSCALE = 2.5;
const ZOOM_STEP = 1.2;
const PORTRAIT_TARGET_VIEWPORT_WIDTH_RATIO = 0.42;
const PORTRAIT_MIN_TARGET_WIDTH = 420;
const PORTRAIT_MAX_TARGET_WIDTH = 760;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getFitScale(input: {
  naturalWidth: number;
  naturalHeight: number;
  stageWidth: number;
  stageHeight: number;
}) {
  const widthScale = input.stageWidth / input.naturalWidth;
  const heightScale = input.stageHeight / input.naturalHeight;

  return clamp(Math.min(widthScale, heightScale, MAX_INITIAL_UPSCALE), 0.1, MAX_INITIAL_UPSCALE);
}

function getInitialScale(input: {
  naturalWidth: number;
  naturalHeight: number;
  stageWidth: number;
  stageHeight: number;
}) {
  const fitScale = getFitScale(input);
  const isPortrait = input.naturalHeight > input.naturalWidth * 1.15;

  if (!isPortrait) {
    return fitScale;
  }

  const portraitTargetWidth = clamp(
    input.stageWidth * PORTRAIT_TARGET_VIEWPORT_WIDTH_RATIO,
    PORTRAIT_MIN_TARGET_WIDTH,
    PORTRAIT_MAX_TARGET_WIDTH,
  );
  const portraitScale = portraitTargetWidth / input.naturalWidth;

  return clamp(Math.max(fitScale, portraitScale), 0.1, MAX_INITIAL_UPSCALE);
}

function clampPan(input: {
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  stageWidth: number;
  stageHeight: number;
  panX: number;
  panY: number;
}) {
  const maxPanX = Math.max(0, (input.naturalWidth * input.zoom - input.stageWidth) / 2);
  const maxPanY = Math.max(0, (input.naturalHeight * input.zoom - input.stageHeight) / 2);

  return {
    x: clamp(input.panX, -maxPanX, maxPanX),
    y: clamp(input.panY, -maxPanY, maxPanY),
  };
}

export function ImagePreviewModal({
  imageUrl,
  title,
  aspectRatio,
  onClose,
}: {
  imageUrl: string | null;
  title: string;
  aspectRatio?: string;
  onClose: () => void;
}) {
  const portalRoot =
    typeof document === "undefined"
      ? null
      : document.getElementById("workflow-canvas-overlay-root");

  if (!imageUrl || !portalRoot) return null;

  return createPortal(
    <PreviewSurface
      key={imageUrl}
      imageUrl={imageUrl}
      title={title}
      aspectRatio={aspectRatio}
      onClose={onClose}
    />,
    portalRoot,
  );
}

function PreviewSurface({
  imageUrl,
  title,
  aspectRatio,
  onClose,
}: {
  imageUrl: string;
  title: string;
  aspectRatio?: string;
  onClose: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [baseFitScale, setBaseFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const updateViewportForSize = (nextNaturalSize: { width: number; height: number }, nextStageSize: { width: number; height: number }) => {
    if (!nextStageSize.width || !nextStageSize.height) return;

    const nextBaseFitScale = getInitialScale({
      naturalWidth: nextNaturalSize.width,
      naturalHeight: nextNaturalSize.height,
      stageWidth: nextStageSize.width,
      stageHeight: nextStageSize.height,
    });

    setBaseFitScale(nextBaseFitScale);
    setZoom(nextBaseFitScale);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!stageRef.current) return;

    const measureStage = () => {
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const width = Math.max(rect.width - VIEWER_PADDING_X, 320);
      const height = Math.max(rect.height - VIEWER_PADDING_Y, 240);
      const nextStageSize = { width, height };
      setStageSize(nextStageSize);
      if (naturalSize) {
        updateViewportForSize(naturalSize, nextStageSize);
      }
    };

    const observer = new ResizeObserver(() => {
      measureStage();
    });
    observer.observe(stageRef.current);
    requestAnimationFrame(measureStage);

    return () => observer.disconnect();
  }, [naturalSize]);

  useEffect(() => {
    if (!isDragging || !naturalSize || !stageSize.width || !stageSize.height) return;

    const handleMouseMove = (event: MouseEvent) => {
      const origin = dragOriginRef.current;
      if (!origin) return;

      const nextPan = clampPan({
        naturalWidth: naturalSize.width,
        naturalHeight: naturalSize.height,
        zoom,
        stageWidth: stageSize.width,
        stageHeight: stageSize.height,
        panX: origin.panX + (event.clientX - origin.startX),
        panY: origin.panY + (event.clientY - origin.startY),
      });

      setPan(nextPan);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragOriginRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, naturalSize, stageSize, zoom]);

  const canPan = Boolean(
    naturalSize &&
    stageSize.width &&
    stageSize.height &&
    (naturalSize.width * zoom > stageSize.width || naturalSize.height * zoom > stageSize.height),
  );

  const minZoom = Math.max(baseFitScale * 0.75, 0.1);
  const maxZoom = Math.max(baseFitScale * 6, 3);

  const updateZoom = (nextZoom: number) => {
    if (!naturalSize || !stageSize.width || !stageSize.height) return;

    const clampedZoom = clamp(nextZoom, minZoom, maxZoom);
    const nextPan = clampPan({
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
      zoom: clampedZoom,
      stageWidth: stageSize.width,
      stageHeight: stageSize.height,
      panX: pan.x,
      panY: pan.y,
    });

    setZoom(clampedZoom);
    setPan(nextPan);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/88 pointer-events-auto" onClick={onClose}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-xl font-medium text-white transition hover:bg-black/72"
        title="关闭预览"
      >
        ×
      </button>

      <div
        ref={stageRef}
        className="absolute inset-0 overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => {
          event.preventDefault();
          const direction = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
          updateZoom(zoom * direction);
        }}
      >
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <img
              src={imageUrl}
              alt={title}
              draggable={false}
              data-aspect-ratio={aspectRatio}
              onLoad={(event) => {
                const nextNaturalSize = {
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                };
                setNaturalSize(nextNaturalSize);
                setIsDragging(false);
                dragOriginRef.current = null;
                updateViewportForSize(nextNaturalSize, stageSize);
              }}
              onMouseDown={(event) => {
                if (!canPan) return;
                event.preventDefault();
                dragOriginRef.current = {
                  startX: event.clientX,
                  startY: event.clientY,
                  panX: pan.x,
                  panY: pan.y,
                };
                setIsDragging(true);
              }}
              className={canPan ? (isDragging ? "cursor-grabbing select-none" : "cursor-grab select-none") : "select-none"}
              style={{
                width: naturalSize ? `${naturalSize.width * zoom}px` : "auto",
                height: naturalSize ? `${naturalSize.height * zoom}px` : "auto",
                maxWidth: naturalSize ? "none" : "min(88vw, 1200px)",
                maxHeight: naturalSize ? "none" : "min(72vh, 900px)",
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
                transformOrigin: "center center",
                boxShadow: "0 32px 120px rgba(0,0,0,0.35)",
              }}
            />
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/12 bg-black/60 px-4 py-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="rounded-full border border-white/12 px-3 py-1.5 text-sm transition hover:bg-white/10"
          onClick={() => updateZoom(zoom / ZOOM_STEP)}
        >
          缩小
        </button>
        <span className="min-w-16 text-center text-sm font-medium">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="rounded-full border border-white/12 px-3 py-1.5 text-sm transition hover:bg-white/10"
          onClick={() => updateZoom(zoom * ZOOM_STEP)}
        >
          放大
        </button>
        <button
          type="button"
          className="rounded-full border border-white/12 px-3 py-1.5 text-sm transition hover:bg-white/10"
          onClick={() => {
            setZoom(baseFitScale);
            setPan({ x: 0, y: 0 });
          }}
        >
          重置
        </button>
      </div>
    </div>
  );
}

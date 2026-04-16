import type {
  MouseEvent as ReactMouseEvent,
  SyntheticEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Point } from "@/components/inpaint/inpaint-utils";

type UseInpaintCanvasOptions = {
  activeTab: "text" | "area";
  modelSupportsEdits: boolean;
};

function clearCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function buildImagePointFromClientCoordinates(input: {
  imageElement: HTMLImageElement;
  clientX: number;
  clientY: number;
  zoom: number;
  panOffset: { x: number; y: number };
}): Point {
  const rect = input.imageElement.getBoundingClientRect();
  const imageAspect = input.imageElement.naturalWidth / input.imageElement.naturalHeight;
  const canvasAspect = rect.width / rect.height;

  let renderWidth: number;
  let renderHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (canvasAspect > imageAspect) {
    renderHeight = rect.height;
    renderWidth = renderHeight * imageAspect;
    offsetX = (rect.width - renderWidth) / 2;
    offsetY = 0;
  } else {
    renderWidth = rect.width;
    renderHeight = renderWidth / imageAspect;
    offsetX = 0;
    offsetY = (rect.height - renderHeight) / 2;
  }

  const displayX = ((input.clientX - rect.left - offsetX) / input.zoom) - input.panOffset.x;
  const displayY = ((input.clientY - rect.top - offsetY) / input.zoom) - input.panOffset.y;

  return {
    x: (displayX / renderWidth) * input.imageElement.naturalWidth,
    y: (displayY / renderHeight) * input.imageElement.naturalHeight,
  };
}

function drawStroke(input: {
  stroke: Point[];
  size: number;
  maskCanvas: HTMLCanvasElement | null;
  overlayCanvas: HTMLCanvasElement | null;
}): void {
  if (!input.maskCanvas || input.stroke.length === 0) {
    return;
  }

  const maskContext = input.maskCanvas.getContext("2d");
  if (!maskContext) {
    return;
  }

  maskContext.strokeStyle = "white";
  maskContext.lineWidth = input.size;
  maskContext.lineCap = "round";
  maskContext.lineJoin = "round";
  maskContext.beginPath();
  maskContext.moveTo(input.stroke[0].x, input.stroke[0].y);
  for (let index = 1; index < input.stroke.length; index += 1) {
    maskContext.lineTo(input.stroke[index].x, input.stroke[index].y);
  }
  maskContext.stroke();

  if (!input.overlayCanvas) {
    return;
  }

  const overlayContext = input.overlayCanvas.getContext("2d");
  if (!overlayContext) {
    return;
  }

  const scaleX = input.overlayCanvas.width / input.maskCanvas.width;
  const scaleY = input.overlayCanvas.height / input.maskCanvas.height;
  overlayContext.strokeStyle = "rgba(255, 80, 80, 0.6)";
  overlayContext.lineWidth = input.size * Math.min(scaleX, scaleY);
  overlayContext.lineCap = "round";
  overlayContext.lineJoin = "round";
  overlayContext.beginPath();
  overlayContext.moveTo(input.stroke[0].x * scaleX, input.stroke[0].y * scaleY);
  for (let index = 1; index < input.stroke.length; index += 1) {
    overlayContext.lineTo(input.stroke[index].x * scaleX, input.stroke[index].y * scaleY);
  }
  overlayContext.stroke();
}

function rebuildMaskCanvases(input: {
  maskCanvas: HTMLCanvasElement | null;
  overlayCanvas: HTMLCanvasElement | null;
  strokes: Point[][];
  brushSize: number;
}): void {
  clearCanvas(input.maskCanvas);
  clearCanvas(input.overlayCanvas);

  for (const stroke of input.strokes) {
    drawStroke({
      stroke,
      size: input.brushSize,
      maskCanvas: input.maskCanvas,
      overlayCanvas: input.overlayCanvas,
    });
  }
}

function buildMaskDataUrl(input: {
  imageElement: HTMLImageElement | null;
  strokes: Point[][];
  brushSize: number;
}): string | null {
  if (!input.imageElement || input.strokes.length === 0) {
    return null;
  }

  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = input.imageElement.naturalWidth;
  offscreenCanvas.height = input.imageElement.naturalHeight;

  const context = offscreenCanvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.fillStyle = "black";
  context.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
  context.strokeStyle = "white";
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const stroke of input.strokes) {
    if (stroke.length === 0) {
      continue;
    }

    context.lineWidth = input.brushSize;
    context.beginPath();
    context.moveTo(stroke[0].x, stroke[0].y);
    for (let index = 1; index < stroke.length; index += 1) {
      context.lineTo(stroke[index].x, stroke[index].y);
    }
    context.stroke();
  }

  return offscreenCanvas.toDataURL("image/png");
}

export function useInpaintCanvas({
  activeTab,
  modelSupportsEdits,
}: UseInpaintCanvasOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [brushSize, setBrushSize] = useState(30);
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [strokeHistory, setStrokeHistory] = useState<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        setSpaceHeld(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (event.code === "Space") {
        setSpaceHeld(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const screenToImage = useCallback((clientX: number, clientY: number): Point => {
    const imageElement = imageElementRef.current;
    if (!imageElement) {
      return { x: 0, y: 0 };
    }

    return buildImagePointFromClientCoordinates({
      imageElement,
      clientX,
      clientY,
      zoom,
      panOffset,
    });
  }, [panOffset, zoom]);

  const drawStrokeOnMask = useCallback((stroke: Point[], size: number): void => {
    drawStroke({
      stroke,
      size,
      maskCanvas: maskCanvasRef.current,
      overlayCanvas: canvasRef.current,
    });
  }, []);

  const handleCanvasMouseDown = useCallback((event: ReactMouseEvent): void => {
    if (!modelSupportsEdits) {
      return;
    }

    if (spaceHeld || activeTab !== "area") {
      setIsPanning(true);
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: panOffset.x,
        panY: panOffset.y,
      };
      return;
    }

    setIsDrawing(true);
    setCurrentStroke([screenToImage(event.clientX, event.clientY)]);
  }, [activeTab, modelSupportsEdits, panOffset, screenToImage, spaceHeld]);

  const handleCanvasMouseMove = useCallback((event: ReactMouseEvent): void => {
    if (isPanning) {
      const dx = (event.clientX - panStartRef.current.x) / zoom;
      const dy = (event.clientY - panStartRef.current.y) / zoom;
      setPanOffset({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
      return;
    }

    if (!isDrawing) {
      return;
    }

    setCurrentStroke((previous) => [...previous, screenToImage(event.clientX, event.clientY)]);
  }, [isDrawing, isPanning, screenToImage, zoom]);

  const handleCanvasMouseUp = useCallback((): void => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDrawing && currentStroke.length > 0) {
      drawStrokeOnMask(currentStroke, brushSize);
      setStrokeHistory((previous) => [...previous, currentStroke]);
      setCurrentStroke([]);
    }

    setIsDrawing(false);
  }, [brushSize, currentStroke, drawStrokeOnMask, isDrawing, isPanning]);

  const handleUndo = useCallback((): void => {
    setStrokeHistory((previous) => {
      const next = previous.slice(0, -1);
      rebuildMaskCanvases({
        maskCanvas: maskCanvasRef.current,
        overlayCanvas: canvasRef.current,
        strokes: next,
        brushSize,
      });
      return next;
    });
  }, [brushSize]);

  const handleClearMask = useCallback((): void => {
    setStrokeHistory([]);
    clearCanvas(maskCanvasRef.current);
    clearCanvas(canvasRef.current);
  }, []);

  const handleWheel = useCallback((event: ReactWheelEvent): void => {
    event.preventDefault();
    setZoom((previous) => Math.max(0.25, Math.min(4, previous - event.deltaY * 0.001)));
  }, []);

  const handleDoubleClick = useCallback((): void => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>): void => {
    const imageElement = event.currentTarget;
    imageElementRef.current = imageElement;

    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) {
      maskCanvas.width = imageElement.naturalWidth;
      maskCanvas.height = imageElement.naturalHeight;
    }

    requestAnimationFrame(() => {
      const overlayCanvas = canvasRef.current;
      if (overlayCanvas) {
        overlayCanvas.width = overlayCanvas.offsetWidth;
        overlayCanvas.height = overlayCanvas.offsetHeight;
      }
    });
  }, []);

  const createMaskDataUrl = useCallback((): string | null => {
    return buildMaskDataUrl({
      imageElement: imageElementRef.current,
      strokes: strokeHistory,
      brushSize,
    });
  }, [brushSize, strokeHistory]);

  return {
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
  };
}

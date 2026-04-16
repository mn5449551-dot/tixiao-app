import type { MutableRefObject } from "react";

export type Point = {
  x: number;
  y: number;
};

export type CopyData = {
  titleMain: string | null;
  titleSub: string | null;
  titleExtra: string | null;
};

export type InpaintResult = {
  imageId: string;
  status: "generating" | "done" | "failed";
} | null;

export function clearPollingInterval(
  pollingRef: MutableRefObject<ReturnType<typeof setInterval> | null>,
): void {
  if (pollingRef.current) {
    clearInterval(pollingRef.current);
    pollingRef.current = null;
  }
}

export function buildTextInpaintPrompt(parts: string[]): string {
  return `请将图片中的文字替换为：${parts.join("，")}。保持图片其他部分不变，仅修改文字内容和排版。`;
}

export function getInpaintTabClass(active: boolean): string {
  if (active) {
    return "border-b-2 border-white text-white";
  }

  return "text-white/40 hover:text-white/70";
}

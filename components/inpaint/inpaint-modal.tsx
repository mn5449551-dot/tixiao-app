"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/field";

interface InpaintModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function InpaintModal({ imageUrl, onClose }: InpaintModalProps) {
  const [activeTool, setActiveTool] = useState<"text" | "select">("text");
  const [extractedTexts, setExtractedTexts] = useState<string[]>(["拍一下10秒出解析"]);
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [selectInstruction, setSelectInstruction] = useState("");
  const [result, setResult] = useState<"idle" | "loading" | "showing">("idle");

  const handleExtractText = () => {
    // Stub: OCR would extract text here
    setExtractedTexts(["拍一下10秒出解析"]);
  };

  const handleTextRegenerate = () => {
    setEditingTextIndex(0);
    setEditText(extractedTexts[0] ?? "");
  };

  const handleTextSave = () => {
    setResult("loading");
    setTimeout(() => {
      setEditingTextIndex(null);
      setResult("showing");
    }, 1000);
  };

  const handleSelectGenerate = () => {
    if (!selectInstruction.trim()) return;
    setResult("loading");
    setTimeout(() => {
      setResult("showing");
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-6xl flex-col rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink-900)]">局部重绘</h2>
            <p className="text-xs text-[var(--ink-500)]">编辑图中文字 或 框选区域进行重绘</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--ink-400)] transition hover:bg-[var(--surface-1)] hover:text-[var(--ink-700)]"
            title="关闭"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 gap-0 overflow-hidden">
          {/* Image preview */}
          <div className="flex w-[60%] flex-col items-center justify-center bg-[var(--surface-1)] p-6">
            {imageUrl ? (
              <div className="relative h-[70vh] w-full">
                <Image
                  src={imageUrl}
                  alt="编辑图片"
                  fill
                  sizes="60vw"
                  className="rounded-2xl border border-[var(--line-soft)] object-contain"
                />
              </div>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--line-soft)] text-[var(--ink-400)]">
                图片加载中
              </div>
            )}

            {/* Tool buttons */}
            <div className="mt-4 flex gap-3">
              <Button
                variant={activeTool === "text" ? "primary" : "secondary"}
                onClick={() => setActiveTool("text")}
                className="text-xs"
              >
                提取文字
              </Button>
              <Button
                variant={activeTool === "select" ? "primary" : "secondary"}
                onClick={() => setActiveTool("select")}
                className="text-xs"
              >
                框选工具
              </Button>
            </div>
          </div>

          {/* Editing panel */}
          <div className="flex w-[40%] flex-col border-l border-[var(--line-soft)] p-6">
            {/* Text editing mode */}
            {activeTool === "text" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ink-900)]">文字编辑</h3>
                <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-1)] p-4">
                  {extractedTexts.length === 0 ? (
                    <Button variant="secondary" onClick={handleExtractText} className="text-xs">
                      提取文字
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      {extractedTexts.map((text, index) => (
                        <div key={index} className="flex items-center justify-between gap-2">
                          {editingTextIndex === index ? (
                            <Textarea
                              minRows={1}
                              className="flex-1 rounded-lg bg-white px-3 py-2"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                          ) : (
                            <span
                              className="cursor-pointer rounded-lg bg-white px-3 py-2 text-sm hover:ring-1 hover:ring-[var(--brand-300)]"
                              onDoubleClick={() => {
                                setEditingTextIndex(index);
                                setEditText(text);
                              }}
                            >
                              {text}
                            </span>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        onClick={handleTextRegenerate}
                        className="text-xs"
                      >
                        {"\u21BB"} 重新生成文字
                      </Button>
                    </div>
                  )}
                </div>

                {editingTextIndex !== null && (
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleTextSave} className="flex-1 text-xs">
                      保存
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setEditingTextIndex(null)}
                      className="text-xs"
                    >
                      取消
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Select inpaint mode */}
            {activeTool === "select" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ink-900)]">框选重绘</h3>
                <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-1)] p-4">
                  <div className="mb-3 h-32 rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-xs text-[var(--ink-400)]">
                    点击图片框选区域（暂未实现）
                  </div>
                  <p className="mb-2 text-xs text-[var(--ink-500)]">已选区域：120×80</p>
                  <Textarea
                    minRows={3}
                    className="rounded-lg bg-white p-3"
                    placeholder="描述你要重绘的内容，例如：把蓝衣服的人换成红衣服的"
                    value={selectInstruction}
                    onChange={(e) => setSelectInstruction(e.target.value)}
                  />
                  <Button
                    variant="primary"
                    onClick={handleSelectGenerate}
                    disabled={!selectInstruction.trim()}
                    className="mt-3 w-full text-xs"
                  >
                    生成
                  </Button>
                </div>
              </div>
            )}

            {/* Result preview */}
            {result === "loading" && (
              <div className="mt-6 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] p-4">
                <div className="flex items-center gap-3">
                  <Spinner size="sm" />
                  <span className="text-sm text-[var(--brand-700)]">生成中...</span>
                </div>
              </div>
            )}

            {result === "showing" && (
              <div className="mt-6 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-1)] p-4">
                <h3 className="mb-3 text-sm font-semibold text-[var(--ink-900)]">生成结果</h3>
                <div className="mb-3 h-32 rounded-lg bg-[var(--surface-2)]" />
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1 text-xs">
                    采纳
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setResult("idle")}
                    className="text-xs"
                  >
                    不采纳
                  </Button>
                </div>
              </div>
            )}

            {/* Confirm apply */}
            {result === "showing" && (
              <Button
                variant="primary"
                className="mt-6 w-full text-sm"
              >
                确认应用
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

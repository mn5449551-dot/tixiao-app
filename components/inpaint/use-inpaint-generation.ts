import { useCallback, useEffect, useRef, useState } from "react";

import type { CopyData, InpaintResult } from "@/components/inpaint/inpaint-utils";
import { buildTextInpaintPrompt, clearPollingInterval } from "@/components/inpaint/inpaint-utils";

type UseInpaintGenerationOptions = {
  imageId: string;
  imageModel?: string | null;
  onClose: () => void;
};

type AreaGenerationOptions = {
  hasMask: boolean;
  maskDataUrl: string | null;
};

export function useInpaintGeneration({
  imageId,
  imageModel,
  onClose,
}: UseInpaintGenerationOptions) {
  const [copyLoading, setCopyLoading] = useState(false);
  const [editedTitleMain, setEditedTitleMain] = useState("");
  const [editedTitleSub, setEditedTitleSub] = useState("");
  const [editedTitleExtra, setEditedTitleExtra] = useState("");
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<InpaintResult>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    setCopyLoading(true);
    fetch(`/api/images/${imageId}/copy`)
      .then((res) => res.json())
      .then((data: CopyData) => {
        if (cancelled) {
          return;
        }

        setEditedTitleMain(data.titleMain ?? "");
        setEditedTitleSub(data.titleSub ?? "");
        setEditedTitleExtra(data.titleExtra ?? "");
      })
      .catch(() => {
        // Leave fields empty when copy fetch fails.
      })
      .finally(() => {
        if (!cancelled) {
          setCopyLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageId]);

  useEffect(() => {
    return () => {
      clearPollingInterval(pollingRef);
    };
  }, []);

  const pollForResult = useCallback((resultImageId: string): void => {
    clearPollingInterval(pollingRef);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/images/${resultImageId}`);
        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as { status: string };
        if (data.status === "done" || data.status === "failed") {
          clearPollingInterval(pollingRef);
          setResult({ imageId: resultImageId, status: data.status });
        }
      } catch {
        // Keep polling.
      }
    }, 2000);
  }, []);

  const submitInpaintRequest = useCallback(async (
    body: Record<string, unknown>,
  ): Promise<void> => {
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/images/${imageId}/inpaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "生成失败");
        return;
      }

      const data = (await res.json()) as { imageId: string; status: string };
      setResult({ imageId: data.imageId, status: "generating" });
      pollForResult(data.imageId);
    } catch {
      setError("网络错误");
    } finally {
      setGenerating(false);
    }
  }, [imageId, pollForResult]);

  const handleTextGenerate = useCallback(async (): Promise<void> => {
    const parts: string[] = [];
    if (editedTitleMain.trim()) parts.push(`主标题「${editedTitleMain.trim()}」`);
    if (editedTitleSub.trim()) parts.push(`副标题「${editedTitleSub.trim()}」`);
    if (editedTitleExtra.trim()) parts.push(`补充文字「${editedTitleExtra.trim()}」`);

    if (parts.length === 0) {
      setError("请至少填写一项文案");
      return;
    }

    await submitInpaintRequest({
      inpaint_instruction: buildTextInpaintPrompt(parts),
      image_model: imageModel,
    });
  }, [
    editedTitleExtra,
    editedTitleMain,
    editedTitleSub,
    imageModel,
    submitInpaintRequest,
  ]);

  const handleAreaGenerate = useCallback(async ({
    hasMask,
    maskDataUrl,
  }: AreaGenerationOptions): Promise<void> => {
    if (!hasMask) {
      setError("请在图片上涂抹标记重绘区域");
      return;
    }

    if (!instruction.trim()) {
      setError("请输入重绘指令");
      return;
    }

    if (!maskDataUrl) {
      setError("重绘区域生成失败，请重试");
      return;
    }

    await submitInpaintRequest({
      mask_data_url: maskDataUrl,
      inpaint_instruction: instruction,
      image_model: imageModel,
    });
  }, [imageModel, instruction, submitInpaintRequest]);

  const handleAdopt = useCallback((): void => {
    setResult(null);
    onClose();
  }, [onClose]);

  const handleDiscard = useCallback(async (): Promise<void> => {
    if (!result?.imageId) {
      return;
    }

    try {
      await fetch(`/api/images/${result.imageId}`, { method: "DELETE" });
    } catch {
      // Ignore delete errors.
    }

    setResult(null);
  }, [result]);

  const dismissResult = useCallback((): void => {
    setResult(null);
  }, []);

  return {
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
  };
}

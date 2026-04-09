export type CopyPresenterInput = {
  titleMain: string;
  titleSub: string | null;
  titleExtra: string | null;
  copyType: string | null;
};

export function getCopyDisplayRows(
  imageForm: string,
  copy: CopyPresenterInput,
) {
  if (imageForm === "single") {
    return [
      { label: "主标题", value: copy.titleMain },
      { label: "副标题", value: copy.titleSub ?? "" },
    ];
  }

  const rows = [
    { label: "图1文案", value: copy.titleMain },
    { label: "图2文案", value: copy.titleSub ?? "" },
  ];

  if (imageForm === "triple") {
    rows.push({ label: "图3文案", value: copy.titleExtra ?? "" });
  }

  rows.push({
    label: "图间关系",
    value: `${copy.copyType ?? "自动分配"}（AI自动分配）`,
  });

  return rows;
}

export function getCopyCompactSummary(
  imageForm: string,
  copy: CopyPresenterInput,
) {
  if (imageForm === "single") {
    return copy.titleMain;
  }

  const segments = [
    `图1：${copy.titleMain}`,
    `图2：${copy.titleSub ?? ""}`,
  ];

  if (imageForm === "triple") {
    segments.push(`图3：${copy.titleExtra ?? ""}`);
  }

  segments.push(`图间关系：${copy.copyType ?? "自动分配"}`);

  return segments.join("｜");
}

export function getCopyActionState(isLocked: boolean) {
  if (isLocked) {
    return {
      statusLabel: "已生成",
      canGenerate: false,
      canDelete: false,
      deleteHint: "已有下游内容，不能删除",
    };
  }

  return {
    statusLabel: null,
    canGenerate: true,
    canDelete: true,
    deleteHint: null,
  };
}

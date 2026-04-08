type SelectableCopyLike = {
  id: string;
  isLocked: boolean;
};

export function getSelectableCopyIds(items: readonly SelectableCopyLike[]) {
  return items.filter((item) => !item.isLocked).map((item) => item.id);
}

export function areAllSelectableCopiesSelected(
  items: readonly SelectableCopyLike[],
  selectedIds: ReadonlySet<string>,
) {
  const selectableIds = getSelectableCopyIds(items);
  if (selectableIds.length === 0) return false;
  return selectableIds.every((id) => selectedIds.has(id));
}

export function toggleSelectableCopyIds(
  items: readonly SelectableCopyLike[],
  selectedIds: ReadonlySet<string>,
) {
  if (areAllSelectableCopiesSelected(items, selectedIds)) {
    return new Set<string>();
  }

  return new Set(getSelectableCopyIds(items));
}

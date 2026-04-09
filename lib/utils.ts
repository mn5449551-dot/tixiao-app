export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatRelativeDate(timestamp: number) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return formatter.format(new Date(timestamp));
}

export function toJson<T>(value: T) {
  return JSON.stringify(value);
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toCssAspectRatio(value?: string) {
  if (!value) return "1 / 1";
  return value.replace(":", " / ");
}

export function toVersionedFileUrl(fileUrl: string | null | undefined, updatedAt?: number | null) {
  if (!fileUrl) return null;
  if (updatedAt == null) return fileUrl;

  const separator = fileUrl.includes("?") ? "&" : "?";
  return `${fileUrl}${separator}v=${updatedAt}`;
}

"use client";

import Image from "next/image";

import { IP_ASSET_OPTIONS } from "@/lib/ip-asset-metadata";
import { cn } from "@/lib/utils";

export function ImageConfigBrandSection({
  ipRole,
  isIpMode,
  showIpAssetSelector,
  activeIpDescription,
  onIpRoleChange,
}: {
  ipRole: string;
  isIpMode: boolean;
  showIpAssetSelector: boolean;
  activeIpDescription?: string;
  onIpRoleChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2 pt-1">
      <span className="text-sm font-medium text-[var(--ink-900)]">品牌元素</span>

      {isIpMode ? (
        <div className="text-sm font-medium text-[var(--ink-900)]">IP 形象</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--line-soft)] bg-white/70 px-3 py-2">
          <p className="text-sm font-medium text-[var(--ink-700)]">IP 形象</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--ink-500)]">普通模式不可选，切换到 IP 风格后才可选择。</p>
        </div>
      )}

      {showIpAssetSelector ? (
        <div className="ml-6">
          <div className="grid grid-cols-2 gap-2">
            {IP_ASSET_OPTIONS.map((option) => {
              const isActive = ipRole === option.role;
              return (
                <button
                  key={option.role}
                  type="button"
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-white text-left transition",
                    isActive
                      ? "border-[var(--brand-400)] ring-2 ring-[var(--brand-ring)]"
                      : "border-[var(--line-soft)] hover:border-[var(--brand-300)]",
                  )}
                  onClick={() => onIpRoleChange(option.role)}
                >
                  <div className="relative aspect-[4/3] w-full bg-[var(--surface-2)]">
                    <Image src={option.thumbnailUrl} alt={option.role} fill sizes="160px" className="object-contain" />
                  </div>
                  <div className="space-y-1 px-2 py-2">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-medium", isActive ? "text-[var(--brand-600)]" : "text-[var(--ink-800)]")}>
                        {option.role}
                      </span>
                      {isActive ? <span className="text-xs text-[var(--brand-500)]">已选</span> : null}
                    </div>
                    <p className="line-clamp-2 text-xs text-[var(--ink-500)]">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-2 rounded-2xl border border-[var(--line-soft)] bg-white px-3 py-2">
            <p className="text-[10px] font-medium text-[var(--ink-700)]">角色描述</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-500)]">{activeIpDescription}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

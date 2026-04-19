"use client";

import Image from "next/image";

import { IP_ASSET_OPTIONS } from "@/lib/ip-asset-metadata";
import { cn } from "@/lib/utils";

export function ImageConfigBrandSection({
  ipRole,
  isIpMode,
  showIpAssetSelector,
  onIpRoleChange,
}: {
  ipRole: string;
  isIpMode: boolean;
  showIpAssetSelector: boolean;
  onIpRoleChange: (value: string) => void;
}) {
  if (!isIpMode) return null;

  return (
    <div className="space-y-2 pt-1">
      <span className="text-sm font-medium text-[var(--ink-strong)]">IP 形象</span>

      {showIpAssetSelector ? (
        <div className="grid grid-cols-2 gap-2">
          {IP_ASSET_OPTIONS.map((option) => {
            const isActive = ipRole === option.role;
            return (
              <button
                key={option.role}
                type="button"
                className={cn(
                  "overflow-hidden rounded-[var(--radius-md)] border bg-[var(--surface)] text-left transition",
                  isActive
                    ? "border-[var(--brand)] ring-2 ring-[var(--brand-ring)]"
                    : "border-[var(--border)] hover:border-[var(--brand-light)]",
                )}
                onClick={() => onIpRoleChange(option.role)}
              >
                <div className="relative aspect-[4/3] w-full bg-[var(--surface-dim)]">
                  <Image src={option.thumbnailUrl} alt={option.role} fill sizes="160px" className="object-contain" />
                </div>
                <div className="px-2 py-2">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-medium", isActive ? "text-[var(--brand-hover)]" : "text-[var(--ink-default)]")}>
                      {option.role}
                    </span>
                    {isActive ? <span className="text-xs text-[var(--brand)]">已选</span> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

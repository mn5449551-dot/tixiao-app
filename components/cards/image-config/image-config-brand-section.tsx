"use client";

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
      <span className="text-sm font-medium text-[var(--ink-900)]">IP 形象</span>

      {showIpAssetSelector ? (
        <div className="flex flex-wrap gap-2">
          {IP_ASSET_OPTIONS.map((option) => {
            const isActive = ipRole === option.role;
            return (
              <button
                key={option.role}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  isActive
                    ? "border-[var(--brand-500)] bg-gradient-to-r from-[var(--brand-400)] to-[var(--brand-500)] text-white"
                    : "border-[var(--line-strong)] bg-white text-[var(--ink-700)] hover:border-[var(--brand-400)]",
                )}
                onClick={() => onIpRoleChange(option.role)}
              >
                {option.role}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

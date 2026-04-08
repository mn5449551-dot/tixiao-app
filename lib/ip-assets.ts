import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { getIpAssetThumbnailUrl, IP_ASSET_METADATA } from "@/lib/ip-asset-metadata";

const IP_ASSET_ROOT = path.resolve(
  process.cwd(),
  "public/ip-assets",
);

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function getIpAssetPath(ipRole: string) {
  const roleDir = path.join(IP_ASSET_ROOT, ipRole);
  if (!fs.existsSync(roleDir)) {
    throw new Error(`未找到 IP 角色资源目录：${ipRole}`);
  }

  const file = fs
    .readdirSync(roleDir)
    .find((entry) => SUPPORTED_EXTENSIONS.has(path.extname(entry).toLowerCase()));

  if (!file) {
    throw new Error(`未找到 IP 角色资源文件：${ipRole}`);
  }

  return path.join(roleDir, file);
}

export async function readIpAssetAsDataUrl(ipRole: string) {
  const assetPath = getIpAssetPath(ipRole);
  const buffer = await fsp.readFile(assetPath);
  const mimeType = getMimeType(assetPath);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function getIpAssetMetadata(ipRole: string) {
  const metadata = IP_ASSET_METADATA[ipRole as keyof typeof IP_ASSET_METADATA];
  if (!metadata) {
    throw new Error(`未找到 IP 角色元数据：${ipRole}`);
  }

  return {
    ...metadata,
    thumbnailUrl: getIpAssetThumbnailUrl(metadata.role),
  };
}

export async function resolveReferenceImageUrl(input: {
  styleMode: string;
  ipRole?: string | null;
  referenceImageUrl?: string | null;
}) {
  void input.styleMode;
  if (input.ipRole) {
    return readIpAssetAsDataUrl(input.ipRole);
  }

  const reference = input.referenceImageUrl?.trim();
  return reference ? reference : null;
}

function getMimeType(assetPath: string) {
  const ext = path.extname(assetPath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".png":
    default:
      return "image/png";
  }
}

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const LOGO_ASSET_PATHS = {
  onion: fileURLToPath(new URL("../public/brand/onion-logo.png", import.meta.url)),
  onion_app: fileURLToPath(new URL("../public/brand/onion-app-logo.png", import.meta.url)),
} as const;

export function getLogoAssetPath(logo: keyof typeof LOGO_ASSET_PATHS) {
  const assetPath = LOGO_ASSET_PATHS[logo];
  if (!assetPath || !fs.existsSync(assetPath)) {
    throw new Error(`未找到 Logo 资源：${logo}`);
  }
  return assetPath;
}

export async function createLogoPreviewBuffer(logo: keyof typeof LOGO_ASSET_PATHS) {
  const assetPath = getLogoAssetPath(logo);
  const buffer = await fsp.readFile(assetPath);

  return sharp(buffer)
    .ensureAlpha()
    .flatten({ background: "#efe6df" })
    .png()
    .toBuffer();
}

export async function readLogoAssetAsDataUrl(logo: keyof typeof LOGO_ASSET_PATHS) {
  const assetPath = getLogoAssetPath(logo);
  const buffer = await fsp.readFile(assetPath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

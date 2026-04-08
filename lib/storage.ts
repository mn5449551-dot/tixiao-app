import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { getLegacyStorageRoot, getStorageRootPath } from "@/lib/runtime-paths";

const storageRoot = getStorageRootPath();

export function getStorageRoot() {
  migrateLegacyStorageIfNeeded();
  return storageRoot;
}

function migrateLegacyStorageIfNeeded() {
  const legacyStorageRoot = getLegacyStorageRoot();
  if (storageRoot === legacyStorageRoot || fsSync.existsSync(storageRoot) || !fsSync.existsSync(legacyStorageRoot)) {
    return;
  }

  fsSync.mkdirSync(path.dirname(storageRoot), { recursive: true });
  fsSync.cpSync(legacyStorageRoot, storageRoot, { recursive: true });
}

export function getProjectImageDirectory(projectId: string) {
  return path.join(storageRoot, "images", projectId);
}

export async function ensureProjectImageDirectory(projectId: string) {
  migrateLegacyStorageIfNeeded();
  const dir = getProjectImageDirectory(projectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveImageBuffer(input: {
  projectId: string;
  imageId: string;
  buffer: Buffer;
  extension?: "png" | "jpg" | "jpeg" | "webp";
}) {
  const extension = input.extension ?? "png";
  const dir = await ensureProjectImageDirectory(input.projectId);
  const filePath = path.join(dir, `${input.imageId}.${extension}`);
  try {
    const metadata = await sharp(input.buffer).metadata();
    await fs.writeFile(filePath, input.buffer);

    return {
      filePath,
      fileUrl: `/api/images/${input.imageId}/file`,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      extension,
    };
  } catch (error) {
    await fs.rm(filePath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function deleteFileIfExists(filePath: string | null | undefined) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore missing files.
  }
}

export async function applyLogoOverlay(input: {
  sourcePath: string;
  logoPath: string;
  outputPath: string;
  format: "jpg" | "png" | "webp";
}) {
  await writeExportImage(input);
}

export async function writeExportImage(input: {
  sourcePath: string;
  logoPath?: string | null;
  outputPath: string;
  format: "jpg" | "png" | "webp";
  targetWidth?: number;
  targetHeight?: number;
  adaptationMode?: "direct" | "transform" | "postprocess";
}) {
  const source = sharp(input.sourcePath).ensureAlpha();
  const meta = await source.metadata();
  const width = meta.width ?? 1080;
  const height = meta.height ?? 1080;
  const targetWidth = input.targetWidth ?? width;
  const targetHeight = input.targetHeight ?? height;

  let pipeline = source;

  if (targetWidth !== width || targetHeight !== height) {
    pipeline = pipeline.resize({
      width: targetWidth,
      height: targetHeight,
      fit: input.adaptationMode === "postprocess" ? "contain" : "cover",
      position: "centre",
      background: "#ffffff",
    });
  }

  if (input.logoPath) {
    const logoWidth = Math.max(Math.round(targetWidth * 0.22), 180);
    const top = Math.max(Math.round(targetHeight * 0.03), 24);
    const left = Math.max(Math.round(targetWidth * 0.03), 24);

    const logoBuffer = await sharp(input.logoPath)
      .resize({ width: logoWidth })
      .png()
      .toBuffer();

    pipeline = pipeline.composite([{ input: logoBuffer, left, top }]);
  }

  if (input.format === "jpg") {
    pipeline = pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 92 });
  } else if (input.format === "webp") {
    pipeline = pipeline.webp({ quality: 92 });
  } else {
    pipeline = pipeline.png();
  }

  await pipeline.toFile(input.outputPath);
}

export async function createSolidPlaceholder(input: {
  text: string;
  width: number;
  height: number;
}) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fff7ed" />
          <stop offset="100%" stop-color="#f4e3d7" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" rx="32" />
      <rect x="48" y="48" width="${Math.max(input.width - 96, 0)}" height="${Math.max(input.height - 96, 0)}" rx="28" fill="#ffffff" opacity="0.92" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="42" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#8b7355">${escapeXml(input.text)}</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] ?? char));
}

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function zipDirectory(input: { sourceDir: string; outputZipPath: string }) {
  await fs.mkdir(path.dirname(input.outputZipPath), { recursive: true });
  await execFileAsync("/usr/bin/zip", ["-r", input.outputZipPath, "."], { cwd: input.sourceDir });
  return input.outputZipPath;
}

export async function zipAndCleanupDirectory(input: { sourceDir: string; outputZipPath: string }) {
  try {
    return await zipDirectory(input);
  } finally {
    await fs.rm(input.sourceDir, { recursive: true, force: true });
  }
}

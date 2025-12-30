import * as fs from "node:fs";
import * as path from "node:path";

export async function existsDir(p: string): Promise<boolean> {
  try {
    const st = await fs.promises.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

export async function findGitRepos(rootDir: string): Promise<string[]> {
  const repos: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (await existsDir(path.join(dir, ".git"))) {
      repos.push(dir);
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === "node_modules" || e.name === ".git") continue;
      await walk(path.join(dir, e.name));
    }
  }

  await walk(rootDir);
  return repos;
}

/**
 * Reads a text file and returns a cleaned list of non-empty lines.
 * - Splits by LF/CRLF
 * - Trims whitespace
 * - Drops empty lines
 */
export async function readLines(filePath: string): Promise<string[]> {
  return fs
    .readFileSync(filePath, { encoding: "utf8" })
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function getDayAndTimeFromDate(date: Date): {
  day: string;
  time: string;
} {
  const day = date.toLocaleDateString("de-DE");
  const time = date.toLocaleTimeString("de-DE", { hour12: false });
  return { day, time };
}

export function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }

  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mad(values: number[]): number {
  const med = median(values);
  const deviations = values.map((v) => Math.abs(v - med));

  return median(deviations);
}

export function lowerMadThreshold(
  median: number,
  mad: number,
  k: number = 2
): number {
  return median - k * mad;
}

export function shouldIgnoreFile(file: string): boolean {
  if (file.endsWith(".json")) return true;
  if (
    file.includes("/tests/") ||
    file.includes("/test/") ||
    file.includes("/__tests__/")
  )
    return true;
  if (
    file.endsWith(".spec.ts") ||
    file.endsWith(".spec.js") ||
    file.endsWith(".test.ts") ||
    file.endsWith(".test.js")
  )
    return true;
  if (file.endsWith(".yml")) return true;

  return false;
}

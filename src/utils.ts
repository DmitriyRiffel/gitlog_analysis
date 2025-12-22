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
export function readLines(filePath: string): string[] {
  return fs
    .readFileSync(filePath, { encoding: "utf8" })
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

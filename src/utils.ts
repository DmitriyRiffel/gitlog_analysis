import * as fs from "node:fs";
import * as path from "node:path";
import {
  AuthorAggregation,
  COMMIT_TYPE_RULES,
  CommitType,
  CommitWithDiff,
} from "./types";
import { runGit } from "./export_git_logs";

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

function calculateMedian(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }

  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateMad(values: number[]): number {
  const med = calculateMedian(values);
  const deviations = values.map((v) => Math.abs(v - med));

  return calculateMedian(deviations);
}

export function calculateLowerMadThreshold(
  values: number[],
  k: number = 2
): number {
  const median = calculateMedian(values);
  const mad = calculateMad(values);
  return median - k * mad;
}

export function shouldIgnoreFile(file: string): boolean {
  if (file.endsWith(".json")) return true;
  // if (
  //   file.includes("/tests/") ||
  //   file.includes("/test/") ||
  //   file.includes("/__tests__/")
  // )
  //   return true;
  // if (
  //   file.endsWith(".spec.ts") ||
  //   file.endsWith(".spec.js")
  //   // file.endsWith(".test.ts") ||
  //   // file.endsWith(".test.js")
  // )
  //   return true;
  if (file.endsWith(".yml")) return true;

  return false;
}

export function isTestFile(file: string): boolean {
  return (
    file.includes("/tests/") ||
    file.includes("/test/") ||
    file.includes("/__tests__/") ||
    file.endsWith(".spec.ts") ||
    file.endsWith(".spec.js") ||
    file.endsWith(".test.ts") ||
    file.endsWith(".test.js")
  );
}

export function mergeAuthorMaps(
  into: Map<string, AuthorAggregation>,
  from: Map<string, AuthorAggregation>
) {
  for (const [author, agg] of from.entries()) {
    const prev = into.get(author);
    if (!prev) {
      into.set(author, { ...agg });
      continue;
    }
  }
}

const CLONE_DATE_REGEX = /HEAD@\{(\d{2})\.(\d{2})\.(\d{2})\. (\d{2}):(\d{2})\}/;

export function extractAndFormatCloneDate(
  reflogOutput: string
): Date | undefined {
  const match = reflogOutput.match(CLONE_DATE_REGEX);
  if (!match) return undefined;

  const [, d, m, y, h, min] = match;

  const date = new Date(
    2000 + Number(y),
    Number(m) - 1,
    Number(d),
    Number(h),
    Number(min),
    0
  );

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateWithTimezone(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const offsetH = pad(Math.floor(Math.abs(offsetMin) / 60));
  const offsetM = pad(Math.abs(offsetMin) % 60);

  return `${year}-${month}-${day} ${hour}:${minute}:${second} ${sign}${offsetH}${offsetM}`;
}

export async function getCloneDate(repoDir: string): Promise<Date | undefined> {
  const reflog = await runGit(
    ["reflog", "show", "--date=format:%d.%m.%y. %H:%M"],
    repoDir
  );

  if (reflog.code !== 0) {
    console.warn(`git reflog failed in ${repoDir}\n${reflog.stderr}`);
  }

  const dateObj = extractAndFormatCloneDate(reflog.stdout);
  const cloneDate = dateObj ?? undefined;

  if (!dateObj) {
    console.warn(`Kein Klondatum gefunden in ${repoDir}`);
  } else {
    console.log(`Klondatum (${repoDir}): ${dateObj}`);
  }

  return cloneDate;
}

export function earlierDate(firstCommitDate: Date, cloneDate?: Date) {
  if (!cloneDate) return firstCommitDate;
  if (cloneDate > firstCommitDate) return firstCommitDate;
  else return cloneDate;
}

export function determineCommitTypeFromCommit(
  commit: CommitWithDiff
): CommitType {
  if (commit.totalChanges === 0) {
    return CommitType.MIXED;
  }

  const sourcePercent = (commit.totalSourceChanges / commit.totalChanges) * 100;
  const testPercent = (commit.totalTestChanges / commit.totalChanges) * 100;
  const commentPercent =
    (commit.totalCommentChanges / commit.totalChanges) * 100;

  const commitTypes: CommitType[] = [
    CommitType.SOURCE,
    CommitType.TEST,
    CommitType.COMMENT,
    CommitType.MIXED,
  ];
  for (const type of commitTypes) {
    const rule = COMMIT_TYPE_RULES[type];
    if (
      sourcePercent >= rule.sourceMin &&
      sourcePercent <= rule.sourceMax &&
      testPercent >= rule.testMin &&
      testPercent <= rule.testMax &&
      commentPercent >= rule.commentMin &&
      commentPercent <= rule.commentMax
    ) {
      return type;
    }
  }

  return CommitType.MIXED;
}

export function determineCommitTypeFromChanges(
  totalChanges: number,
  totalSourceChanges: number,
  totalTestChanges: number,
  totalCommentChanges: number
): CommitType {
  if (totalChanges === 0) {
    return CommitType.MIXED;
  }

  const sourcePercent = (totalSourceChanges / totalChanges) * 100;
  const testPercent = (totalTestChanges / totalChanges) * 100;
  const commentPercent = (totalCommentChanges / totalChanges) * 100;

  const commitTypes: CommitType[] = [
    CommitType.SOURCE,
    CommitType.TEST,
    CommitType.COMMENT,
    CommitType.MIXED,
  ];
  for (const type of commitTypes) {
    const rule = COMMIT_TYPE_RULES[type];
    if (
      sourcePercent >= rule.sourceMin &&
      sourcePercent <= rule.sourceMax &&
      testPercent >= rule.testMin &&
      testPercent <= rule.testMax &&
      commentPercent >= rule.commentMin &&
      commentPercent <= rule.commentMax
    ) {
      return type;
    }
  }

  return CommitType.MIXED;
}

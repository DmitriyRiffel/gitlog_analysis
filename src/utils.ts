import * as fs from "node:fs";
import * as path from "node:path";
import {
  AuthorAggregation,
  COMMIT_TYPE_RULES,
  CommitType,
  CommitWithDiff,
  Session,
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

/** Anfangsprompt: Wie könnte man eine Textdatei einlesen, in einzelne Zeilen aufteilen, Leerzeichen bereinigen und leere Zeilen entfernen
 */
export async function readLines(filePath: string): Promise<string[]> {
  return (
    fs
      /**ist Asynchrone Funktion liest aber Files synchron */
      .readFileSync(filePath, { encoding: "utf8" })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
  );
}

export function getDayAndTimeFromDate(date: Date): {
  day: string;
  time: string;
} {
  const day = date.toLocaleDateString("de-DE");
  const time = date.toLocaleTimeString("de-DE", { hour12: false });
  return { day, time };
}

export function shouldIgnoreFile(file: string): boolean {
  if (file.endsWith(".json")) return true;
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
  from: Map<string, AuthorAggregation>,
) {
  for (const [author, agg] of from.entries()) {
    const prev = into.get(author);
    if (!prev) {
      into.set(author, { ...agg });
      continue;
    }
  }
}

/** Bereitsgestellt von Prof. Dr. Jens von Pilgrim */
const CLONE_DATE_REGEX = /HEAD@\{(\d{2})\.(\d{2})\.(\d{2})\. (\d{2}):(\d{2})\}/;

export function extractAndFormatCloneDate(
  reflogOutput: string,
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
    0,
  );

  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function getCloneDate(repoDir: string): Promise<Date | undefined> {
  const reflog = await runGit(
    ["reflog", "show", "--date=format:%d.%m.%y. %H:%M"],
    repoDir,
  );

  if (reflog.code !== 0) {
    console.warn(`git reflog failed in ${repoDir}\n${reflog.stderr}`);
  }

  const dateObj = extractAndFormatCloneDate(reflog.stdout);

  if (!dateObj) {
    console.warn(`Kein Klondatum gefunden in ${repoDir}`);
  } else {
    console.log(`Klondatum: ${dateObj}`);
  }

  return dateObj;
}

export function earlierDate(firstCommitDate: Date, cloneDate?: Date) {
  if (!cloneDate) return firstCommitDate;
  if (cloneDate > firstCommitDate) return firstCommitDate;
  else return cloneDate;
}

export function determineCommitTypeFromCommit(
  commit: CommitWithDiff,
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
  totalCommentChanges: number,
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

export function calculatePercent(total: number, part: number) {
  return ((part / total) * 100).toFixed(2);
}

export function exportCsv(tableRows: Record<string, any>[], filename: string) {
  if (tableRows.length === 0) return;

  /* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/join
  */
  const header = Object.keys(tableRows[0]).join(",");

  const lines = tableRows.map((row) =>
    Object.values(row)
      /* https://stackoverflow.com/questions/769621/dealing-with-commas-in-a-csv-file */
      .map((v) => `"${String(v)}"`)
      .join(","),
  );

  const csv = [header, ...lines].join("\n");
  /* https://nodejs.org/api/fs.html#fswritefilesyncfile-data-options */
  fs.writeFileSync(filename, csv, "utf8");
}

export function calculateCommitBundling(commits: CommitWithDiff[]) {
  const totals = commits.map((c) => c.totalChanges);

  const totalChanges = totals.reduce((a, b) => a + b, 0);
  const maxCommit = Math.max(...totals);

  const bundling = maxCommit / totalChanges;

  return Number((Math.round(bundling * 100) / 100).toFixed(2));
}

export function calculateAverageChangesPerHourOverSessions(
  sessions: Session[],
  skipFirstCommit: boolean,
) {
  let amountOfSessions = 0;
  let changes = 0;
  if (skipFirstCommit) {
    for (let s = 1; s < sessions.length; s++) {
      amountOfSessions += 1;
      changes += sessions[s].changesPerHour;
    }
  } else {
    for (let s = 0; s < sessions.length; s++) {
      amountOfSessions += 1;
      changes += sessions[s].changesPerHour;
    }
  }
  return Math.round(changes / amountOfSessions);
}

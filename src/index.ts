import * as fs from "node:fs";
import * as path from "node:path";
import {
  AuthorAggregation,
  Commit,
  CommitWithDiff,
  CriteriaRow,
  Stats,
  ZERO_STATS,
} from "./types";

async function existsDir(p: string): Promise<boolean> {
  try {
    const st = await fs.promises.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}
async function findGitRepos(rootDir: string): Promise<string[]> {
  const repos: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (await existsDir(path.join(dir, ".git"))) {
      repos.push(dir);
      return;
    }
    let entries;
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

/** One "numstat-like" row */
type FileStatRow = {
  hash: string;
  file: string;
  insertions: number;
  deletions: number;
};

let amountOfCommits: number[] = [];
let sum = 0;

const authorAggregation = new Map<string, AuthorAggregation>();

function getOrCreateAuthor(author: string): AuthorAggregation {
  const existing = authorAggregation.get(author);
  if (existing) return existing;

  const fresh: AuthorAggregation = {
    author,
    commitCount: 0,
    firstCommitAt: new Date(),
    firstCommitHash: "",
    lastCommitAt: new Date(),
    totalInsertions: 0,
    totalDeletions: 0,
    totalChanges: 0,
  };
  authorAggregation.set(author, fresh);
  return fresh;
}

async function createCSV(repo: string) {
  /**
   * Reads a text file and returns a cleaned list of non-empty lines.
   * - Splits by LF/CRLF
   * - Trims whitespace
   * - Drops empty lines
   */
  function readLines(path: string): string[] {
    return fs
      .readFileSync(path, { encoding: "utf8" })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  /** Read commit metadata lines and skip CSV header row */
  const commitLines = readLines(repo + "/commits.csv").slice(1);

  /**
   * Splits one commit line by "|" into:
   * hash | author | email | date | subject
   *
   * Note: subject might contain "|" itself, so the remaining parts is going to be joined
   */
  function splitCommitLinePipe(
    line: string
  ): [string, string, string, string, string] {
    const parts = line.split("|");

    const hash = (parts[0] ?? "").trim();
    const author = (parts[1] ?? "").trim();
    const email = (parts[2] ?? "").trim();
    const date = (parts[3] ?? "").trim();
    const subject = parts.slice(4).join("|").trim();

    return [hash, author, email, date, subject];
  }

  /** Parse commits, filter out a specific author, convert date to Date object, and sort chronologically */
  const commits: Commit[] = commitLines
    .map(splitCommitLinePipe)
    .filter((p) => p[1] !== "Jens von Pilgrim")
    .map((p) => ({
      hash: p[0].trim(),
      author: p[1].trim(),
      email: p[2].trim(),
      date: new Date(p[3]),
      subject: p[4].trim(),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  /**
   * Parses a per-file stat line (hash|file|ins|del).
   * Handles "-" / empty as 0 (common for binary files in git numstat output).
   * Returns null if the line is invalid.
   */
  function parseFileStatLine(line: string): FileStatRow | null {
    const parts = line.split("|");
    if (parts.length < 4) return null;

    const hash = parts[0].trim();
    const file = parts[1].trim();

    const insStr = parts[2].trim();
    const delStr = parts[3].trim();

    const insertions = Number(insStr);
    const deletions = Number(delStr);

    // Validate: hash must be 40 hex chars
    if (!/^[0-9a-f]{40}$/i.test(hash)) return null;
    if (!file) return null;
    if (!Number.isFinite(insertions) || !Number.isFinite(deletions))
      return null;

    return { hash, file, insertions, deletions };
  }

  /** Read per-file stats and skip CSV header row */
  const statsLines = readLines(repo + "/commits_with_stats.csv")
    .slice(1)
    .filter((f) => !f.includes("json") && !f.includes("tests"));

  /** Aggregate stats per commit hash */
  const statsByHash = new Map<string, Stats>();

  /** Track unique files per commit hash */
  const filesByHash = new Map<string, Set<string>>();

  for (const line of statsLines) {
    const row = parseFileStatLine(line);
    if (!row) continue;

    // Add file to the set for this commit hash
    if (!filesByHash.has(row.hash)) filesByHash.set(row.hash, new Set());
    filesByHash.get(row.hash)!.add(row.file);

    // Sum insertions/deletions per commit hash
    const prev = statsByHash.get(row.hash) ?? { ...ZERO_STATS };

    const insertions = prev.insertions + row.insertions;
    const deletions = prev.deletions + row.deletions;

    statsByHash.set(row.hash, {
      filesChanged: 0,
      insertions,
      deletions,
      totalChanges: insertions + deletions,
    });
  }

  // After collecting all files, compute filesChanged = number of unique files per commit
  for (const [hash, set] of filesByHash.entries()) {
    const prev = statsByHash.get(hash) ?? { ...ZERO_STATS };
    statsByHash.set(hash, { ...prev, filesChanged: set.size });
  }

  /**
   * Build the final table:
   * - day/time strings
   * - diffHours/diffMinutes within the same day (reset to 0 on day change)
   * - changesPerHour/changesPerMinute based on totalChanges
   */
  const commitsWithDiff: CommitWithDiff[] = commits
    .map((c, i) => {
      // "sv-SE" gives YYYY-MM-DD reliably for locale date strings
      const day = c.date.toLocaleDateString("sv-SE");
      // 24h time formatting
      const time = c.date.toLocaleTimeString("de-DE", { hour12: false });

      // Look up aggregated stats; default to zeros if missing
      const stats = statsByHash.get(c.hash) ?? ZERO_STATS;

      // First commit: no previous diff
      if (i === 0) {
        return {
          ...c,
          day,
          time,
          diffHours: 0,
          diffMinutes: 0,
          ...stats,
          changesPerHour: 0,
          changesPerMinute: 0,
        };
      }

      const prev = commits[i - 1];
      const prevDay = prev.date.toLocaleDateString("sv-SE");

      // If the commit is on a new day, reset the diff to 0
      if (day !== prevDay) {
        return {
          ...c,
          day,
          time,
          diffHours: 0,
          diffMinutes: 0,
          ...stats,
          changesPerHour: 0,
          changesPerMinute: 0,
        };
      }

      // Same day: compute time difference vs previous commit
      const diffMs = c.date.getTime() - prev.date.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffMinutes = diffHours * 60;

      // Compute "speed" metrics; avoid division by zero
      const changesPerHour =
        diffHours !== 0 ? stats.totalChanges / diffHours : 0;
      const changesPerMinute =
        diffMinutes !== 0 ? stats.totalChanges / diffMinutes : 0;

      return {
        ...c,
        day,
        time,
        diffHours,
        diffMinutes,
        ...stats,
        changesPerHour,
        changesPerMinute,
      };
    })
    .filter((c) => c.totalChanges > 0);

  console.table(
    commitsWithDiff.map((c) => ({
      hash: c.hash,
      author: c.author,
      subject: c.subject,
      day: c.day,
      time: c.time,
      files: c.filesChanged,
      ins: c.insertions,
      del: c.deletions,
      total: c.totalChanges,
      diff_hours: Number(c.diffHours.toFixed(3)),
      diff_minutes: Number(c.diffMinutes.toFixed(3)),
      changes_hour: Number(c.changesPerHour.toFixed(2)),
    }))
  );

  for (const c of commitsWithDiff) {
    const a = getOrCreateAuthor(c.author);

    a.commitCount += 1;
    a.totalInsertions += c.insertions;
    a.totalDeletions += c.deletions;
    a.totalChanges += c.totalChanges;

    if (!a.firstCommitAt || c.date < a.firstCommitAt) {
      a.firstCommitAt = c.date;
      a.firstCommitHash = c.hash;
    }

    if (!a.lastCommitAt || c.date > a.lastCommitAt) {
      a.lastCommitAt = c.date;
    }
  }

  amountOfCommits.push(commitsWithDiff.length);
  sum += commitsWithDiff.length;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }

  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function mad(values: number[]): number {
  const med = median(values);

  const deviations = values.map((v) => Math.abs(v - med));

  return median(deviations);
}

function lowerMadThreshold(median: number, mad: number, k: number = 2): number {
  return median - k * mad;
}

async function main() {
  const rootDir = "F:/Hochschule/BA/sample1";

  const repoDirs = await findGitRepos(rootDir);
  console.log(`Gefundene Repos: ${repoDirs.length}`);

  for (const repo of repoDirs) {
    await createCSV(repo);
  }

  console.log("Anzahl von commits: ", amountOfCommits);
  console.log("Sum: ", sum);

  const med = median(amountOfCommits);
  const madVal = mad(amountOfCommits);
  console.log("threshold: ", lowerMadThreshold(med, madVal));

  const deadline = new Date("2024-04-28");
  deadline.setHours(20, 0, 0);
  const deadlineDay = deadline.toLocaleDateString("sv-SE");
  const rows: CriteriaRow[] = [...authorAggregation.values()].map((a) => ({
    author: a.author,
    commitCount: a.commitCount,
    totalChanges: a.totalChanges,
    tooLittleCommits:
      a.commitCount <= lowerMadThreshold(med, madVal, 2) ? "ja" : "nein",
    firstCommitDay: a.firstCommitAt.toLocaleDateString("sv-SE"),
    firstCommitTime: a.firstCommitAt?.toLocaleTimeString("de-DE", {
      hour12: false,
    }),
    lastCommitDay: a.lastCommitAt?.toLocaleDateString("sv-SE"),
    firstCommitAtDeadline:
      a.firstCommitAt?.toLocaleDateString("sv-SE") === deadlineDay
        ? "ja"
        : "nein",
  }));

  console.table(
    rows.map((r) => ({
      author: r.author,
      commits_count: r.commitCount,
      total_changes: r.totalChanges,
      first_commit_date: r.firstCommitDay,
      first_commit_time: r.firstCommitTime,
      first_commit_at_deadline_day: r.firstCommitAtDeadline,
      too_little_commits: r.tooLittleCommits,
      too_late_first_commit:
        r.firstCommitTime > deadline.getHours().toString() ? "ja" : "nein",
    }))
  );
}

main();

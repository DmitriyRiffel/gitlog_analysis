import { parseFileStatLine, splitCommitLinePipe } from "./parsers";
import {
  AuthorAggregation,
  Commit,
  CommitWithDiff,
  Stats,
  ZERO_STATS,
} from "./types";
import { readLines } from "./utils";

export function createCSV(repo: string): Commit[] {
  /** Read commit metadata lines and skip CSV header row */
  const commitLines = readLines(repo + "/commits.csv").slice(1);

  /** Parse commits, filter out a specific author, convert date to Date object, and sort chronologically */
  return commitLines
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
}

export function buildStatsByHash(repo: string): Map<string, Stats> {
  /** Read per-file stats and skip CSV header row */
  const statsLines = readLines(repo + "/commits_with_stats.csv")
    .filter((f) => !f.includes("json"))
    .filter((f) => !f.includes("tests"))
    .slice(1);

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

  return statsByHash;
}

export function buildCommitsWithDiff(
  commits: Commit[],
  statsByHash: Map<string, Stats>
): CommitWithDiff[] {
  const rows = commits.map((c, i) => {
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
    const changesPerHour = diffHours !== 0 ? stats.totalChanges / diffHours : 0;
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
  });

  return rows.filter((c) => c.totalChanges > 0);
}

export function aggregateAuthors(
  commits: CommitWithDiff[]
): Map<string, AuthorAggregation> {
  const map = new Map<string, AuthorAggregation>();

  function getOrCreate(author: string): AuthorAggregation {
    const existing = map.get(author);
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
    map.set(author, fresh);
    return fresh;
  }

  for (const c of commits) {
    const a = getOrCreate(c.author);

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
  return map;
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

export function analyzeRepo(repo: string) {
  const commits = createCSV(repo);
  const statsByHash = buildStatsByHash(repo);
  const commitsWithDiff = buildCommitsWithDiff(commits, statsByHash);
  const authors = aggregateAuthors(commitsWithDiff);
  return { commitsWithDiff, authors };
}

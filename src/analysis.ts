import { parseFileStatLine, splitCommitLinePipe } from "./parsers";
import {
  AuthorAggregation,
  Commit,
  CommitWithDiff,
  Session,
  Stats,
  ZERO_STATS,
} from "./types";
import { readLines } from "./utils";

export function createCSV(repo: string): Commit[] {
  /** Read commit metadata lines and skip CSV header row */
  const commitLines = readLines(repo + "/commits.csv").slice(1);

  /** ToDo: Remove later on. Only for development */
  const subdir = repo.split("\\");
  const submission =
    subdir.find((session) => session.startsWith("submission_")) ?? "";

  const parsed = commitLines
    .map(splitCommitLinePipe)
    .filter((p) => p[1] !== "Jens von Pilgrim")
    .map((p) => ({
      hash: p[0].trim(),
      rawAuthor: p[1].trim(),
      email: p[2].trim(),
      date: new Date(p[3]),
      subject: p[4].trim(),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const uniqueAuthors = Array.from(
    new Set(parsed.map((commit) => commit.rawAuthor).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const mergedAuthorName =
    uniqueAuthors.join(" - ") + (submission ? ` ${submission}` : "");

  return parsed.map((commit) => ({
    hash: commit.hash,
    author: mergedAuthorName,
    email: commit.email,
    date: commit.date,
    subject: commit.subject,
  }));

  /** Parse commits, filter out a specific author, convert date to Date object, and sort chronologically */
  // return commitLines
  //   .map(splitCommitLinePipe)
  //   .filter((p) => p[1] !== "Jens von Pilgrim")
  //   .map((p) => ({
  //     hash: p[0].trim(),
  //     author: p[1].trim() + " " + submission,
  //     email: p[2].trim(),
  //     date: new Date(p[3]),
  //     subject: p[4].trim(),
  //   }))
  //   .sort((a, b) => a.date.getTime() - b.date.getTime());
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
  const rows = commits.map((commit, i) => {
    // "sv-SE" gives YYYY-MM-DD reliably for locale date strings
    const day = commit.date.toLocaleDateString("sv-SE");
    // 24h time formatting
    const time = commit.date.toLocaleTimeString("de-DE", { hour12: false });

    // Look up aggregated stats; default to zeros if missing
    const stats = statsByHash.get(commit.hash) ?? ZERO_STATS;

    // First commit: no previous diff
    if (i === 0) {
      return {
        ...commit,
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
        ...commit,
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
    const diffMs = commit.date.getTime() - prev.date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffMinutes = diffHours * 60;

    // Compute "speed" metrics; avoid division by zero
    const changesPerHour = diffHours !== 0 ? stats.totalChanges / diffHours : 0;
    const changesPerMinute =
      diffMinutes !== 0 ? stats.totalChanges / diffMinutes : 0;

    return {
      ...commit,
      day,
      time,
      diffHours,
      diffMinutes,
      ...stats,
      changesPerHour,
      changesPerMinute,
    };
  });

  return rows.filter((r) => r.totalChanges > 0);
}

export function aggregateAuthors(
  commits: CommitWithDiff[],
  sessions: Session[]
): Map<string, AuthorAggregation> {
  const map = new Map<string, AuthorAggregation>();
  const sessionsByAuthor = aggregateSessionsByAuthor(sessions);

  function getOrCreate(author: string): AuthorAggregation {
    const existing = map.get(author);
    if (existing) return existing;

    const fresh: AuthorAggregation = {
      author,
      commitCount: 0,
      firstCommitDate: new Date(8640000000000000),
      firstCommitHash: "",
      lastCommitAt: new Date(0),
      totalInsertions: 0,
      totalDeletions: 0,
      totalChanges: 0,
      sessions: sessionsByAuthor.get(author) ?? [],
    };
    map.set(author, fresh);
    return fresh;
  }

  for (const commit of commits) {
    const a = getOrCreate(commit.author);

    a.commitCount += 1;
    a.totalInsertions += commit.insertions;
    a.totalDeletions += commit.deletions;
    a.totalChanges += commit.totalChanges;

    if (!a.firstCommitDate || commit.date < a.firstCommitDate) {
      a.firstCommitDate = commit.date;
      a.firstCommitHash = commit.hash;
    }

    if (!a.lastCommitAt || commit.date > a.lastCommitAt) {
      a.lastCommitAt = commit.date;
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
  const sessions = buildSessions(commitsWithDiff, 120);
  const authors = aggregateAuthors(commitsWithDiff, sessions);
  return { commitsWithDiff, sessions, authors };
}

function buildSessions(
  commits: CommitWithDiff[],
  maxGapMinutes: number
): Session[] {
  if (commits.length === 0) return [];

  const sessions: Session[] = [];
  let sessionIndex = 1;

  let current: Session = newSession(commits[0], sessionIndex);

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    if (i === 0) {
      addCommit(current, c);
      continue;
    }

    const gap = c.diffMinutes;
    const isBreak = gap <= 0 || gap > maxGapMinutes;

    if (isBreak) {
      finalizeSession(current);
      sessions.push(current);

      sessionIndex++;
      current = newSession(c, sessionIndex);
    }

    addCommit(current, c);
  }

  finalizeSession(current);
  sessions.push(current);

  return sessions;
}

function newSession(commit: CommitWithDiff, index: number): Session {
  return {
    author: commit.author,
    sessionIndex: index,
    startDate: commit.date,
    endDate: commit.date,
    durationMinutes: 0,
    commitCount: 0,
    filesChanged: 0,
    insertions: 0,
    deletions: 0,
    totalChanges: 0,
  };
}

function addCommit(session: Session, commit: CommitWithDiff) {
  session.endDate = commit.date;
  session.commitCount += 1;

  session.filesChanged += commit.filesChanged;
  session.insertions += commit.insertions;
  session.deletions += commit.deletions;
  session.totalChanges += commit.totalChanges;
}

function finalizeSession(session: Session) {
  const duration =
    (session.endDate.getTime() - session.startDate.getTime()) / (1000 * 60);

  session.durationMinutes = Number(Math.max(0, duration).toFixed(1));

  if (session.durationMinutes > 0) {
    session.changesPerHour =
      session.totalChanges / (session.durationMinutes / 60);
  } else {
    session.changesPerHour = 0;
  }
}

function aggregateSessionsByAuthor(
  sessions: Session[]
): Map<string, Session[]> {
  const map = new Map<string, Session[]>();

  for (const s of sessions) {
    const arr = map.get(s.author);
    if (arr) {
      arr.push(s);
    } else {
      map.set(s.author, [s]);
    }
  }

  return map;
}

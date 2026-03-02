import { parseFileStatLine, splitCommitLinePipe } from "./parsers";
import {
  AuthorAggregation,
  Commit,
  CommitType,
  CommitWithDiff,
  Session,
  Stats,
  ZERO_STATS,
} from "./types";
import {
  calculateAvaregeChangesPerHourOverSessions,
  calculateCommitBundling,
  determineCommitTypeFromChanges,
  determineCommitTypeFromCommit,
  getCloneDate,
  isTestFile,
  readLines,
  shouldIgnoreFile,
} from "./utils";

/** Anfangsprompt: Wie könnte man Commit-Daten aus einer CSV-Datei bereinigen, filtern und konsolidieren, bevor man sie strukturiert weiterverwendet? */
async function createCSV(repo: string): Promise<Commit[]> {
  /** Read commit metadata lines and skip CSV header row */
  const commitLines = (await readLines(repo + "/commits.csv")).slice(1);

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
    new Set(parsed.map((commit) => commit.rawAuthor).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const mergedAuthorName = uniqueAuthors.join(" - ");

  return parsed.map((commit) => ({
    hash: commit.hash,
    author: mergedAuthorName,
    email: commit.email,
    date: commit.date,
    subject: commit.subject,
  }));
}

export async function buildStatsByHash(
  repo: string,
): Promise<Map<string, Stats>> {
  /** Read per-file stats and skip CSV header row */
  const statsLines = (await readLines(repo + "/commits_with_stats.csv")).slice(
    1,
  );

  /** Aggregate stats per commit hash */
  const statsByHash = new Map<string, Stats>();

  /** Track unique files per commit hash */
  const filesByHash = new Map<string, Set<string>>();

  for (const line of statsLines) {
    const row = parseFileStatLine(line);
    if (!row) continue;
    const isTest = isTestFile(row.file);
    if (shouldIgnoreFile(row.file)) continue;
    // Add file to the set for this commit hash
    if (!filesByHash.has(row.hash)) filesByHash.set(row.hash, new Set());
    filesByHash.get(row.hash)?.add(row.file);

    // Sum sourceInsertions/sourceDeletions per commit hash
    const prev = statsByHash.get(row.hash) ?? { ...ZERO_STATS };

    const sourceInsertions =
      prev.sourceInsertions + (isTest ? 0 : row.sourceInsertions);
    const sourceDeletions =
      prev.sourceDeletions + (isTest ? 0 : row.sourceDeletions);
    const commentInsertions =
      prev.commentInsertions + (isTest ? 0 : row.commentInsertions);
    const commentDeletions =
      prev.commentDeletions + (isTest ? 0 : row.commentDeletions);
    const testInsertions =
      prev.testInsertions + (isTest ? row.sourceInsertions : 0);
    const testDeletions =
      prev.testDeletions + (isTest ? row.sourceDeletions : 0);
    const totalSourceChanges = sourceInsertions + sourceDeletions;
    const totalCommentChanges = commentInsertions + commentDeletions;
    const totalTestChanges = testInsertions + testDeletions;
    const totalChanges =
      totalCommentChanges + totalSourceChanges + totalTestChanges;
    const type = determineCommitTypeFromChanges(
      totalChanges,
      totalSourceChanges,
      totalTestChanges,
      totalCommentChanges,
    );

    statsByHash.set(row.hash, {
      filesChanged: 0,
      sourceInsertions,
      commitType: type,
      totalChanges: totalChanges,
      sourceDeletions,
      totalSourceChanges: totalSourceChanges,
      commentInsertions,
      commentDeletions,
      totalCommentChanges: totalCommentChanges,
      testInsertions,
      testDeletions,
      totalTestChanges: totalTestChanges,
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
  statsByHash: Map<string, Stats>,
): CommitWithDiff[] {
  const rows = commits.map((commit, i) => {
    const day = commit.date.toLocaleDateString("de-DE");
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
    const prevDay = prev.date.toLocaleDateString("de-DE");

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
    const changesPerHour =
      diffHours !== 0
        ? (stats.totalSourceChanges +
            stats.totalTestChanges +
            stats.totalCommentChanges) /
          diffHours
        : 0;
    const changesPerMinute =
      diffMinutes !== 0 ? stats.totalSourceChanges / diffMinutes : 0;

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

  return rows.filter(
    (r) =>
      r.totalSourceChanges > 0 ||
      r.totalTestChanges > 0 ||
      r.totalCommentChanges > 0,
  );
  return rows;
}

function aggregateAuthors(
  commits: CommitWithDiff[],
  sessions: Session[],
  skipFirstCommit: boolean,
): Map<string, AuthorAggregation> {
  const map = new Map<string, AuthorAggregation>();
  const sessionsByAuthor = aggregateSessionsByAuthor(sessions);
  const firstCommitSkipped = new Map<string, boolean>();
  const commitsByAuthor = new Map<string, CommitWithDiff[]>();

  function getOrCreate(author: string): AuthorAggregation {
    const existing = map.get(author);
    if (existing) return existing;

    const fresh: AuthorAggregation = {
      author,
      repo: "",
      cloneDate: undefined,
      firstCommitHash: "",
      firstCommitDate: new Date(8640000000000000),
      lastCommitDate: new Date(0),
      totalSourceInsertions: 0,
      totalSourceDeletions: 0,
      totalCommentInsertions: 0,
      totalCommentDeletions: 0,
      totalSourceChanges: 0,
      totalCommentChanges: 0,
      totalTestInsertions: 0,
      totalTestDeletions: 0,
      totalTestChanges: 0,
      totalChanges: 0,
      totalCommentCommits: 0,
      totalSourceCommits: 0,
      totalTestCommits: 0,
      totalMixedCommits: 0,
      totalCommits: 0,
      bundling_coeff: 0,
      sessions: sessionsByAuthor.get(author) ?? [],
      avaregeChangesPerHourOverSessions: 0,
    };
    map.set(author, fresh);
    return fresh;
  }

  for (const commit of commits) {
    const a = getOrCreate(commit.author);

    if (skipFirstCommit) {
      if (!firstCommitSkipped.get(commit.author)) {
        firstCommitSkipped.set(commit.author, true);
        continue;
      }
    }

    if (!commitsByAuthor.has(commit.author)) {
      commitsByAuthor.set(commit.author, []);
    }
    commitsByAuthor.get(commit.author)!.push(commit);

    a.bundling_coeff = calculateCommitBundling(commits);
    a.totalCommits += 1;
    a.totalSourceInsertions += commit.sourceInsertions;
    a.totalSourceDeletions += commit.sourceDeletions;
    a.totalSourceChanges += commit.totalSourceChanges;
    a.totalCommentInsertions += commit.commentInsertions;
    a.totalCommentDeletions += commit.commentDeletions;
    a.totalCommentChanges += commit.totalCommentChanges;
    a.totalTestChanges += commit.totalTestChanges;
    a.totalChanges += commit.totalChanges;
    if (commit.date < a.firstCommitDate) {
      a.firstCommitDate = commit.date;
      a.firstCommitHash = commit.hash;
    }

    if (commit.date > a.lastCommitDate) {
      a.lastCommitDate = commit.date;
    }

    switch (commit.commitType) {
      case CommitType.SOURCE:
        a.totalSourceCommits += 1;
        break;
      case CommitType.TEST:
        a.totalTestCommits += 1;
        break;
      case CommitType.COMMENT:
        a.totalCommentCommits += 1;
        break;
      case CommitType.MIXED:
        a.totalMixedCommits += 1;
        break;
    }

    for (const [author, authorCommits] of commitsByAuthor) {
      const a = map.get(author);
      if (a) {
        a.bundling_coeff = calculateCommitBundling(authorCommits);
      }
    }
  }

  // Berechne avaregeChangesPerHourOverSessions für jeden Author
  for (const author of map.values()) {
    author.avaregeChangesPerHourOverSessions =
      calculateAvaregeChangesPerHourOverSessions(
        author.sessions,
        skipFirstCommit,
      );
  }

  return map;
}

export async function analyzeRepo(repo: string, skipFirstCommit: boolean) {
  const commits = createCSV(repo);
  const statsByHash = buildStatsByHash(repo);
  const repoCloneDate = await getCloneDate(repo);
  const commitsWithDiff = buildCommitsWithDiff(
    await commits,
    await statsByHash,
  );
  const sessions = buildSessions(commitsWithDiff, 120);

  const authors = aggregateAuthors(commitsWithDiff, sessions, skipFirstCommit);
  if (repoCloneDate) {
    for (const a of authors.values()) {
      a.cloneDate = repoCloneDate;
    }
  }
  return { commitsWithDiff, sessions, authors };
}

function buildSessions(
  commits: CommitWithDiff[],
  maxGapMinutes: number,
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
    commitType: determineCommitTypeFromCommit(commit),
    totalCommits: 0,
    filesChanged: 0,
    totalChanges: 0,
    sourceInsertions: 0,
    sourceDeletions: 0,
    totalSourceChanges: 0,
    commentInsertions: 0,
    commentDeletions: 0,
    totalCommentChanges: 0,
    testInsertions: 0,
    testDeletions: 0,
    totalTestChanges: 0,
    changesPerHour: 0,
  };
}

function addCommit(session: Session, commit: CommitWithDiff) {
  session.endDate = commit.date;
  session.totalCommits += 1;

  session.filesChanged += commit.filesChanged;
  session.sourceInsertions += commit.sourceInsertions;
  session.sourceDeletions += commit.sourceDeletions;
  session.totalSourceChanges += commit.totalSourceChanges;
  session.commentInsertions += commit.commentInsertions;
  session.commentDeletions += commit.commentDeletions;
  session.totalCommentChanges += commit.commentInsertions;
  session.totalChanges += commit.totalChanges;
}

function finalizeSession(session: Session) {
  const duration =
    (session.endDate.getTime() - session.startDate.getTime()) / (1000 * 60);

  session.durationMinutes = Number(Math.max(0, duration).toFixed(1));

  if (session.totalCommits >= 3) {
    session.changesPerHour =
      session.totalChanges / (session.durationMinutes / 60);
  } else {
    session.changesPerHour = session.totalChanges;
  }
}

function aggregateSessionsByAuthor(
  sessions: Session[],
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

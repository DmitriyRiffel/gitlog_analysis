import {
  CommitWithDiff,
  CriteriaRow,
  AuthorAggregation,
  Session,
} from "./types";

export function printCommitsTable(commits: CommitWithDiff[]) {
  console.table(
    commits.map((c) => ({
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
}

export function buildCriteriaRows(
  authors: Map<string, AuthorAggregation>,
  tooLittleCommitThreshold: number,
  tooLittleChangesThreshold: number,
  deadline = new Date("2024-04-28T23:59:00")
): CriteriaRow[] {
  const deadlineDay = deadline.toLocaleDateString("sv-SE");
  return [...authors.values()].map((a) => {
    const firstDay = a.firstCommitDate.toLocaleDateString("sv-SE");
    const firstTime = a.firstCommitDate.toLocaleTimeString("de-DE", {
      hour12: false,
    });
    return {
      author: a.author,
      commitCount: a.commitCount,
      totalChanges: a.totalChanges,
      tooLittleCommits: a.commitCount <= tooLittleCommitThreshold,
      tooLittleChanges: a.totalChanges <= tooLittleChangesThreshold,
      firstCommitDate: a.firstCommitDate,
      firstCommitDay: firstDay,
      firstCommitTime: firstTime,
      totalSessions: a.sessions.length,
      averageChangesPerHour: calculateAverageChangesPerHour(a.sessions),
      lastCommitDay: a.lastCommitAt.toLocaleDateString("sv-SE"),
      firstCommitAtDeadline: firstDay === deadlineDay,
    };
  });
}

export function printCriteriaTable(
  rows: CriteriaRow[],
  deadline = new Date("2024-04-28T23:59:00"),
  plannedHours = 6
) {
  console.table(
    rows.map((row) => ({
      author: row.author,
      commits_count: row.commitCount,
      total_changes: row.totalChanges,
      first_commit_date: row.firstCommitDay,
      first_commit_time: row.firstCommitTime,
      last_commit_date: row.lastCommitDay,
      first_commit_at_deadline_day: row.firstCommitAtDeadline ? "ja" : "nein",
      too_little_commits: row.tooLittleCommits ? "ja" : "nein",
      too_little_changes: row.tooLittleChanges ? "ja" : "nein",
      too_late_first_commit: isTooLateFirstCommit(
        row.firstCommitDate,
        deadline,
        plannedHours
      )
        ? "ja"
        : "nein",
      total_sessions: row.totalSessions,
      average_changes_hour_session: row.averageChangesPerHour,
      index: calculateIndex(row, deadline, plannedHours),
    }))
  );
}

function calculateIndex(
  row: CriteriaRow,
  deadline = new Date("2024-04-28T23:59:00"),
  plannedHours = 6
): number {
  let index: number = 0;
  if (row.firstCommitAtDeadline) index += 0.1;
  if (row.tooLittleChanges) index += 0.1;
  if (row.tooLittleCommits) index += 0.1;
  if (isTooLateFirstCommit(row.firstCommitDate, deadline, plannedHours))
    index += 0.1;
  return Number(index.toFixed(1));
}

function subtractHours(d: Date, hours: number): Date {
  return new Date(d.getTime() - hours * 60 * 60 * 1000);
}

function isTooLateFirstCommit(
  firstCommitAt: Date,
  deadline: Date,
  plannedHours: number
): boolean {
  return firstCommitAt > subtractHours(deadline, plannedHours);
}

function calculateAverageChangesPerHour(sessions: Session[]) {
  let temp = 0;
  let counter = 0;
  for (const s of sessions) {
    temp += s.changesPerHour ?? 0;
    counter++;
  }
  return temp / counter;
}

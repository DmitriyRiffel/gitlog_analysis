import { CommitWithDiff, CriteriaRow, AuthorAggregation } from "./types";

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
  tooLittleCommitThreshold: number
): CriteriaRow[] {
  const deadline = new Date("2024-04-28T23:59:00");
  const deadlineDay = deadline.toLocaleDateString("sv-SE");

  return [...authors.values()].map((a) => {
    const firstDay = a.firstCommitAt.toLocaleDateString("sv-SE");
    const firstTime = a.firstCommitAt.toLocaleTimeString("de-DE", {
      hour12: false,
    });

    return {
      author: a.author,
      commitCount: a.commitCount,
      totalChanges: a.totalChanges,
      tooLittleCommits:
        a.commitCount <= tooLittleCommitThreshold ? "ja" : "nein",
      firstCommitDay: firstDay,
      firstCommitTime: firstTime,
      lastCommitDay: a.lastCommitAt.toLocaleDateString("sv-SE"),
      firstCommitAtDeadline: firstDay === deadlineDay ? "ja" : "nein",
    };
  });
}

export function printCriteriaTable(rows: CriteriaRow[]) {
  /**ToDo: improve the calculation of too_late_first_commit */
  const deadline = new Date("2024-04-28T20:00:00");
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
        r.firstCommitTime > deadline.toLocaleTimeString() ? "ja" : "nein",
    }))
  );
}

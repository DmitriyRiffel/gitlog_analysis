import {
  CommitWithDiff,
  CriteriaRow,
  AuthorAggregation,
  Session,
} from "./types";
import { getDayAndTimeFromDate } from "./utils";

export function printCommitsTable(commits: CommitWithDiff[]) {
  console.table(
    commits.map((c) => ({
      hash: c.hash.slice(0, 10),
      author: c.author,
      subject: c.subject,
      date: c.day + " " + c.time,
      files: c.filesChanged,
      source_ins: c.insertions,
      source_del: c.deletions,
      source_total: c.totalChanges,
      comment_ins: c.commentInsertions,
      comment_del: c.commentDeletions,
      comment_total: c.totalCommentChanges,
      tests_ins: c.insertionsInTests,
      tests_del: c.deletionsInTests,
      tests_total: c.totalChangesInTests,
      diff_hours: Number(c.diffHours.toFixed(3)),
      diff_minutes: Number(c.diffMinutes.toFixed(3)),
      changes_hour: Number(c.changesPerHour.toFixed(2)),
    }))
  );
}

export function buildCriteriaRows(
  authors: Map<string, AuthorAggregation>,
  thresholdCommitCount: number,
  thresholdTotalChanges: number,
  thresholdChangesInTests: number,
  deadline = new Date("2024-04-28T23:59:00")
): CriteriaRow[] {
  return [...authors.values()].map((a) => {
    return {
      author: a.author,
      commitCount: a.commitCount,
      totalChanges: a.totalChanges,
      totalChangesInTests: a.totalChangesInTests,
      totalCommentChanges: a.totalCommentChanges,
      areFewCommits: a.commitCount <= thresholdCommitCount,
      areFewChanges: a.totalChanges <= thresholdTotalChanges,
      areFewChangesInTests: a.totalChangesInTests <= thresholdChangesInTests,
      firstCommitDate: a.firstCommitDate,
      lastCommitDate: a.lastCommitDate,
      totalSessions: a.sessions.length,
      averageChangesPerHour: calculateAverageChangesPerHour(a.sessions),
      averageCommitsPerSession: calculateAverageCommitsPerSession(a.sessions),
      lastCommitDay: getDayAndTimeFromDate(a.lastCommitDate).day,
      firstCommitOnDeadline:
        getDayAndTimeFromDate(a.firstCommitDate).day ===
        getDayAndTimeFromDate(deadline).day,
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
      commits: row.commitCount,
      changes: row.totalChanges,
      comment_changes: row.totalCommentChanges,
      tests_changes: row.totalChangesInTests,
      first_date:
        getDayAndTimeFromDate(row.firstCommitDate).day +
        " " +
        getDayAndTimeFromDate(row.firstCommitDate).time,
      last_date:
        getDayAndTimeFromDate(row.lastCommitDate).day +
        " " +
        getDayAndTimeFromDate(row.lastCommitDate).time,
      deadline:
        getDayAndTimeFromDate(deadline).day +
        " " +
        getDayAndTimeFromDate(deadline).time,
      first_on_deadline: row.firstCommitOnDeadline ? "ja" : "nein",
      late_start: isTooLateFirstCommit(
        row.firstCommitDate,
        deadline,
        plannedHours
      )
        ? "ja"
        : "nein",
      few_commits: row.areFewCommits ? "ja" : "nein",
      few_changes: row.areFewChanges ? "ja" : "nein",
      few_tests: row.areFewChangesInTests ? "ja" : "nein",

      sessions: row.totalSessions,
      // average_changes_hour_session: row.averageChangesPerHour,
      // average_changes_session: row.totalChanges / row.totalSessions,
      avg_commits: row.averageCommitsPerSession,
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
  if (row.firstCommitOnDeadline) index += 0.25;
  if (row.areFewChanges) index += 0.125;
  if (row.areFewChangesInTests) index += 0.125;
  if (row.areFewCommits) index += 0.25;
  if (isTooLateFirstCommit(row.firstCommitDate, deadline, plannedHours))
    index += 0.25;
  return Number(index.toFixed(2));
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

function calculateAverageCommitsPerSession(sessions: Session[]) {
  let temp = 0;
  let counter = 0;
  for (const s of sessions) {
    temp += s.commitCount;
    counter++;
  }
  return Number((temp / counter).toFixed(1));
}

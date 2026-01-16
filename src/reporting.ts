import {
  CommitWithDiff,
  CriteriaRow,
  AuthorAggregation,
  Session,
  CommitType,
} from "./types";
import { earlierDate, getDayAndTimeFromDate } from "./utils";

export function printCommitsTable(commits: CommitWithDiff[]) {
  console.table(
    commits.map((c) => ({
      hash: c.hash.slice(0, 10),
      author: c.author,
      subject: c.subject,
      date: c.day + " " + c.time,
      files: c.filesChanged,
      source_ins: c.sourceInsertions,
      source_del: c.sourceDeletions,
      source_total: c.totalSourceChanges,
      comment_ins: c.commentInsertions,
      comment_del: c.commentDeletions,
      comment_total: c.totalCommentChanges,
      tests_ins: c.testInsertions,
      tests_del: c.testDeletions,
      tests_total: c.totalTestChanges,
      total: c.totalChanges,
      type: CommitType[c.commitType],
      diff_hours: Number(c.diffHours.toFixed(3)),
      diff_minutes: Number(c.diffMinutes.toFixed(3)),
      changes_hour: Number(c.changesPerHour.toFixed(2)),
    }))
  );
}

export function buildCriteriaRows(
  authors: Map<string, AuthorAggregation>,
  thresholdCommitCount: number,
  thresholdtotalSourceChanges: number,
  thresholdChangesInTests: number,
  deadline = new Date("2024-04-28T23:59:00")
): CriteriaRow[] {
  return [...authors.values()].map((a) => {
    const startDate = earlierDate(a.firstCommitDate, a.cloneDate);
    return {
      author: a.author,
      commitCount: a.commitCount,
      totalSourceChanges: a.totalSourceChanges,
      totalTestChanges: a.totalTestChanges,
      totalCommentChanges: a.totalCommentChanges,
      totalChanges: a.totalChanges,
      areFewCommits: a.commitCount <= thresholdCommitCount,
      areFewChanges: a.totalSourceChanges <= thresholdtotalSourceChanges,
      areFewChangesInTests: a.totalTestChanges <= thresholdChangesInTests,
      startDate: startDate,
      endDate: a.lastCommitDate,
      totalSessions: a.sessions.length,
      averageChangesPerHour: calculateAverageChangesPerHour(a.sessions),
      averageCommitsPerSession: calculateAverageCommitsPerSession(a.sessions),
      firstCommitOnDeadline:
        getDayAndTimeFromDate(startDate).day ===
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
      source_changes: row.totalSourceChanges,
      comment_changes: row.totalCommentChanges,
      test_changes: row.totalTestChanges,
      total_changes: row.totalChanges,
      start_date:
        getDayAndTimeFromDate(row.startDate).day +
        " " +
        getDayAndTimeFromDate(row.startDate).time,
      end_date:
        getDayAndTimeFromDate(row.endDate).day +
        " " +
        getDayAndTimeFromDate(row.endDate).time,
      deadline:
        getDayAndTimeFromDate(deadline).day +
        " " +
        getDayAndTimeFromDate(deadline).time,
      first_on_deadline: row.firstCommitOnDeadline ? "ja" : "nein",
      late_start: isTooLateFirstCommit(row.startDate, deadline, plannedHours)
        ? "ja"
        : "nein",
      few_commits: row.areFewCommits ? "ja" : "nein",
      few_changes: row.areFewChanges ? "ja" : "nein",
      few_tests: row.areFewChangesInTests ? "ja" : "nein",

      sessions: row.totalSessions,
      // average_changes_hour_session: row.averageChangesPerHour,
      // average_changes_session: row.totalSourceChanges / row.totalSessions,
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
  if (isTooLateFirstCommit(row.startDate, deadline, plannedHours))
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

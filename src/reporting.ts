import {
  CommitWithDiff,
  CriteriaRow,
  AuthorAggregation,
  Session,
  CommitType,
} from "./types";
import {
  calculateCommitBundling,
  calculateAvaregeChangesPerHourOverSessions,
  calculatePercent,
  earlierDate,
  exportCsv,
  getDayAndTimeFromDate,
} from "./utils";
import ExcelJS from "exceljs";

export function printCommitsTable(
  commits: CommitWithDiff[],
  skipFirstCommit: boolean,
) {
  const filteredCommits = skipFirstCommit ? commits.slice(1) : commits;
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
    })),
  );
  console.log("Bundling: ", calculateCommitBundling(filteredCommits));
}

export function buildCriteriaRows(
  authors: Map<string, AuthorAggregation>,
  thresholdCommitCount: number,
  thresholdtotalSourceChanges: number,
  thresholdChangesInTests: number,
  skipFirstCommit: boolean,
  deadline = new Date("2024-04-28T23:59:00"),
): CriteriaRow[] {
  return [...authors.values()].map((a) => {
    const startDate = earlierDate(a.firstCommitDate, a.cloneDate);
    return {
      author: a.author,

      totalSourceChanges: a.totalSourceChanges,
      totalTestChanges: a.totalTestChanges,
      totalCommentChanges: a.totalCommentChanges,
      totalChanges: a.totalChanges,

      areFewCommits: a.totalCommits <= thresholdCommitCount,
      areFewChanges: a.totalSourceChanges <= thresholdtotalSourceChanges,
      areFewChangesInTests: a.totalTestChanges <= thresholdChangesInTests,

      startDate: startDate,
      endDate: a.lastCommitDate,
      totalSessions: a.sessions.length,

      totalCommits: a.totalCommits,
      totalCommentCommits: a.totalCommentCommits,
      totalSourceCommits: a.totalSourceCommits,
      totalTestCommits: a.totalTestCommits,
      totalMixedCommits: a.totalMixedCommits,

      bundling_coeff: a.bundling_coeff,

      averageChangesPerHour: calculateAverageChangesPerHour(a.sessions),
      averageCommitsPerSession: calculateAverageCommitsPerSession(a.sessions),
      firstCommitOnDeadline:
        getDayAndTimeFromDate(startDate).day ===
        getDayAndTimeFromDate(deadline).day,
      avaregeChangesPerHourOverSessions:
        calculateAvaregeChangesPerHourOverSessions(
          a.sessions,
          skipFirstCommit,
        ),
    };
  });
}

function formatWithPercent(total: number, value: number): string {
  // return `${value} (${calculatePercent(total, value)} %)`;
  return `${calculatePercent(total, value)} % (${value})`;
}

export function printCriteriaTable(
  rows: CriteriaRow[],
  deadline = new Date("2024-04-28T23:59:00"),
  plannedHours: number = 6,
  repoName: string,
) {
  const tableRows = rows.map((row) => ({
    author: row.author,
    total_commits: `${row.totalCommits}`,
    mixed_commits: formatWithPercent(row.totalCommits, row.totalMixedCommits),
    source_commits: formatWithPercent(row.totalCommits, row.totalSourceCommits),
    test_commits: formatWithPercent(row.totalCommits, row.totalTestCommits),
    comment_commits: formatWithPercent(
      row.totalCommits,
      row.totalCommentCommits,
    ),
    total_changes: formatWithPercent(row.totalChanges, row.totalChanges),
    source_changes: formatWithPercent(row.totalChanges, row.totalSourceChanges),
    comment_changes: formatWithPercent(
      row.totalChanges,
      row.totalCommentChanges,
    ),
    test_changes: formatWithPercent(row.totalChanges, row.totalTestChanges),
    bundling: row.bundling_coeff,
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
    // first_on_deadline: row.firstCommitOnDeadline ? "ja" : "nein",
    // late_start: isTooLateFirstCommit(row.startDate, deadline, plannedHours)
    //   ? "ja"
    //   : "nein",
    // few_commits: row.areFewCommits ? "ja" : "nein",
    // few_changes: row.areFewChanges ? "ja" : "nein",
    // few_tests: row.areFewChangesInTests ? "ja" : "nein",

    sessions: row.totalSessions,
    // average_changes_hour_session: row.averageChangesPerHour,
    // average_changes_session: row.totalSourceChanges / row.totalSessions,
    avg_commits: row.averageCommitsPerSession,

    /** Average changes per hour over the sessions */
    avg_changes: row.avaregeChangesPerHourOverSessions,

    index: calculateIndex(row, deadline, plannedHours),
  }));

  console.table(tableRows);
  // exportCsv(tableRows, `criteriaTable_${repoName}.csv`);
}

function calculateIndex(
  row: CriteriaRow,
  deadline = new Date("2024-04-28T23:59:00"),
  plannedHours = 6,
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
  plannedHours: number,
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

// Excel Export Funktionalität
export type ExcelExportData = {
  commits: { repoName: string; data: CommitWithDiff[]; skipFirstCommit: boolean }[];
  sessions: { repoName: string; data: Session[] }[];
  criteria: { rows: CriteriaRow[]; deadline: Date; plannedHours: number };
};

export async function exportToExcel(
  data: ExcelExportData,
  filename: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GitLog Analysis";
  workbook.created = new Date();

  // Criteria Tabelle (die wichtigste Tabelle)
  addCriteriaSheet(workbook, data.criteria);

  // Alle Sessions zusammengefasst in einem Sheet
  addAllSessionsSheet(workbook, "Alle Sessions", data.sessions);

  // Alle Commits zusammengefasst in einem Sheet
  addAllCommitsSheet(workbook, "Alle Commits", data.commits);

  // Datei speichern
  await workbook.xlsx.writeFile(filename);
  console.log(`\n✓ Excel-Datei gespeichert: ${filename}`);
}

function addCriteriaSheet(
  workbook: ExcelJS.Workbook,
  data: { rows: CriteriaRow[]; deadline: Date; plannedHours: number },
): void {
  const sheet = workbook.addWorksheet("Kriterien-Übersicht");

  // Header
  sheet.columns = [
    { header: "Autor", key: "author", width: 20 },
    { header: "Total Commits", key: "total_commits", width: 15 },
    { header: "Mixed Commits", key: "mixed_commits", width: 18 },
    { header: "Source Commits", key: "source_commits", width: 18 },
    { header: "Test Commits", key: "test_commits", width: 18 },
    { header: "Comment Commits", key: "comment_commits", width: 18 },
    { header: "Total Changes", key: "total_changes", width: 18 },
    { header: "Source Changes", key: "source_changes", width: 18 },
    { header: "Comment Changes", key: "comment_changes", width: 18 },
    { header: "Test Changes", key: "test_changes", width: 18 },
    { header: "Bundling", key: "bundling", width: 12 },
    { header: "Start Date", key: "start_date", width: 20 },
    { header: "End Date", key: "end_date", width: 20 },
    { header: "Deadline", key: "deadline", width: 20 },
    { header: "Sessions", key: "sessions", width: 12 },
    { header: "Avg Commits", key: "avg_commits", width: 15 },
    { header: "Avg Changes/h", key: "avg_changes", width: 15 },
    { header: "Index", key: "index", width: 10 },
  ];

  // Header Style
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Daten hinzufügen
  data.rows.forEach((row) => {
    sheet.addRow({
      author: row.author,
      total_commits: row.totalCommits,
      mixed_commits: formatWithPercent(row.totalCommits, row.totalMixedCommits),
      source_commits: formatWithPercent(row.totalCommits, row.totalSourceCommits),
      test_commits: formatWithPercent(row.totalCommits, row.totalTestCommits),
      comment_commits: formatWithPercent(row.totalCommits, row.totalCommentCommits),
      total_changes: formatWithPercent(row.totalChanges, row.totalChanges),
      source_changes: formatWithPercent(row.totalChanges, row.totalSourceChanges),
      comment_changes: formatWithPercent(row.totalChanges, row.totalCommentChanges),
      test_changes: formatWithPercent(row.totalChanges, row.totalTestChanges),
      bundling: row.bundling_coeff,
      start_date: getDayAndTimeFromDate(row.startDate).day + " " + getDayAndTimeFromDate(row.startDate).time,
      end_date: getDayAndTimeFromDate(row.endDate).day + " " + getDayAndTimeFromDate(row.endDate).time,
      deadline: getDayAndTimeFromDate(data.deadline).day + " " + getDayAndTimeFromDate(data.deadline).time,
      sessions: row.totalSessions,
      avg_commits: row.averageCommitsPerSession,
      avg_changes: row.avaregeChangesPerHourOverSessions,
      index: calculateIndex(row, data.deadline, data.plannedHours),
    });
  });

  // Autofilter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 18 },
  };
}

function addAllSessionsSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  sessionsByRepo: { repoName: string; data: Session[] }[],
): void {
  const sheet = workbook.addWorksheet(sheetName);

  // Header
  sheet.columns = [
    { header: "Repository", key: "repository", width: 25 },
    { header: "Autor", key: "author", width: 20 },
    { header: "Session Index", key: "session_index", width: 15 },
    { header: "Commits", key: "commits", width: 10 },
    { header: "Duration (min)", key: "duration_min", width: 15 },
    { header: "Total Changes", key: "total_changes", width: 15 },
    { header: "Changes/h", key: "changes_hour", width: 12 },
  ];

  // Header Style
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFC000" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Daten hinzufügen mit Repository-Trennung
  sessionsByRepo.forEach((sessionData, index) => {
    sessionData.data.forEach((s) => {
      sheet.addRow({
        repository: sessionData.repoName,
        author: s.author,
        session_index: s.sessionIndex,
        commits: s.commitCount,
        duration_min: s.durationMinutes,
        total_changes: s.totalChanges,
        changes_hour: s.changesPerHour ?? 0,
      });
    });

    // Leerzeile nach jedem Repository (außer dem letzten)
    if (index < sessionsByRepo.length - 1) {
      sheet.addRow({});
    }
  });

  // Autofilter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 7 },
  };
}

function addAllCommitsSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  commitsByRepo: { repoName: string; data: CommitWithDiff[]; skipFirstCommit: boolean }[],
): void {
  const sheet = workbook.addWorksheet(sheetName);

  // Header
  sheet.columns = [
    { header: "Repository", key: "repository", width: 25 },
    { header: "Hash", key: "hash", width: 12 },
    { header: "Autor", key: "author", width: 20 },
    { header: "Subject", key: "subject", width: 40 },
    { header: "Datum", key: "date", width: 20 },
    { header: "Files", key: "files", width: 8 },
    { header: "Source Ins", key: "source_ins", width: 12 },
    { header: "Source Del", key: "source_del", width: 12 },
    { header: "Source Total", key: "source_total", width: 12 },
    { header: "Comment Ins", key: "comment_ins", width: 12 },
    { header: "Comment Del", key: "comment_del", width: 12 },
    { header: "Comment Total", key: "comment_total", width: 12 },
    { header: "Tests Ins", key: "tests_ins", width: 12 },
    { header: "Tests Del", key: "tests_del", width: 12 },
    { header: "Tests Total", key: "tests_total", width: 12 },
    { header: "Total", key: "total", width: 10 },
    { header: "Type", key: "type", width: 12 },
    { header: "Diff Hours", key: "diff_hours", width: 12 },
    { header: "Diff Minutes", key: "diff_minutes", width: 12 },
    { header: "Changes/h", key: "changes_hour", width: 12 },
  ];

  // Header Style
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF70AD47" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Daten hinzufügen mit Repository-Trennung
  commitsByRepo.forEach((commitData, index) => {
    commitData.data.forEach((c) => {
      sheet.addRow({
        repository: commitData.repoName,
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
      });
    });

    // Bundling-Info und Leerzeile nach jedem Repository
    const filteredCommits = commitData.skipFirstCommit ? commitData.data.slice(1) : commitData.data;
    const bundling = calculateCommitBundling(filteredCommits);
    sheet.addRow({});
    sheet.addRow({ repository: `Bundling (${commitData.repoName}):`, author: bundling });

    if (index < commitsByRepo.length - 1) {
      sheet.addRow({});
    }
  });

  // Autofilter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 20 },
  };
}

/** Prompt: ich gebe mehrere tabellen in terminal aus. Wie könnte ich das ganze irgendwie in einer Excel-Datei exportieren / speichern mit hilfe von exceljs?
 * ----------------------
*/

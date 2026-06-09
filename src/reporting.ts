import {
  calculateAverageChangesPerHour,
  calculateAverageCommitsPerSession,
  calculateIndex,
  isTooLateFirstCommit,
} from "./calculations";
import {
  CommitWithDiff,
  CriteriaRow,
  AuthorAggregation,
  Session,
  CommitType,
  MetricWeights,
  MetricThresholds,
  ExcelExportData,
} from "./types";
import {
  calculateCommitBundling,
  calculatePercent,
  earlierDate,
  exportCsv,
  getDayAndTimeFromDate,
} from "./utils";
import ExcelJS from "exceljs";

const myWeights: MetricWeights = {
  // Gewichtung der einzelnen Auffaelligkeiten fuer den finalen Index.
  areFewChanges: 0.15,
  areFewChangesInTests: 0.1,
  areFewCommits: 0.2,
  areFewMixedCommits: 0.05,
  isTooLateFirstCommit: 0.25,
  changesPerHour: 0.2,
  isBundled: 0.05,
};

export function printCommitsTable(
  commits: CommitWithDiff[],
  skipFirstCommit: boolean,
) {
  // Optional wird der erste Commit ausgelassen, weil er oft nur Projektstart
  // oder Grundgeruest enthaelt und die Auswertung verzerren kann.
  const filteredCommits = skipFirstCommit ? commits.slice(1) : commits;
  console.table(
    // Fuer die Konsolenausgabe werden nur lesbare Kurzwerte angezeigt.
    filteredCommits.map((c) => ({
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
  // Bundling zeigt, wie stark Aenderungen in wenigen grossen Commits gesammelt sind.
  console.log("Bundling: ", calculateCommitBundling(filteredCommits));
}

export function buildCriteriaRows(
  authors: Map<string, AuthorAggregation>,
  thresholds: MetricThresholds,
  deadline = new Date("2024-04-28T23:59:00"),
): CriteriaRow[] {
  // Aus den aggregierten Autorendaten werden Zeilen fuer die Kriterien-Tabelle gebaut.
  return [...authors.values()].map((a) => {
    // Als Startdatum zaehlt das fruehere Datum aus erstem Commit und Klondatum.
    const startDate = earlierDate(a.firstCommitDate, a.cloneDate);
    return {
      author: a.author,

      totalSourceChanges: a.totalSourceChanges,
      totalTestChanges: a.totalTestChanges,
      totalCommentChanges: a.totalCommentChanges,
      totalChanges: a.totalChanges,

      areFewCommits: a.totalCommits <= thresholds.totalCommits,
      areFewChanges: a.totalChanges <= thresholds.totalChanges,
      areFewChangesInTests: a.totalTestChanges <= thresholds.totalTestChanges,
      areFewMixedCommits: a.totalMixedCommits / a.totalCommits <= 0.5,

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
      isBundled:
        a.totalCommits >= thresholds.totalCommits &&
        a.bundling_coeff >= thresholds.bundling,
      averageChangesPerHourOverSessions: a.averageChangesPerHourOverSessions,
    };
  });
}

function formatWithPercent(total: number, value: number): string {
  // return `${value} (${calculatePercent(total, value)} %)`;
  // Ausgabeformat fuer Tabellen: erst Prozentwert, dann absoluter Wert.
  return `${calculatePercent(total, value)} % (${value})`;
}

export function printCriteriaTable(
  rows: CriteriaRow[],
  thresholds: MetricThresholds,
  deadline: Date,
  plannedHours: number,
  repoName: string,
) {
  // Baut die reine Darstellungsform fuer console.table und CSV-Export.
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
    "source_changes*": formatWithPercent(
      row.totalChanges,
      row.totalSourceChanges,
    ),
    "comment_changes*": formatWithPercent(
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
    first_on_deadline: row.firstCommitOnDeadline ? "ja" : "nein",
    late_start: isTooLateFirstCommit(row.startDate, deadline, plannedHours)
      ? "ja"
      : "nein",
    "sessions*": row.totalSessions,
    "avg_commits*": row.averageCommitsPerSession,

    /** Average changes per hour over the sessions */
    avg_changes: row.averageChangesPerHourOverSessions,

    index: calculateIndex(row, myWeights, thresholds, deadline, plannedHours),
  }));

  console.table(tableRows);
  // Speichert dieselbe Kriterien-Tabelle zusaetzlich als CSV-Datei.
  exportCsv(tableRows, `criteriaTable_${repoName}.csv`);
}

/**
 * Prompt: Kannst du mir machen, dass alle Schwellenwerte in einer Methode berechnet werden
 * Berechnet alle Schwellwerte für Metriken über alle Autoren/Repos hinweg
 */
export async function exportToExcel(
  data: ExcelExportData,
  filename: string,
): Promise<void> {
  // Erstellt eine neue Excel-Arbeitsmappe mit allen Auswertungstabellen.
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

export async function exportRepoCommitsTableToExcel(
  repoName: string,
  commits: CommitWithDiff[],
  skipFirstCommit: boolean,
  filename: string,
): Promise<void> {
  // Variante fuer den Export nur einer Commit-Tabelle eines einzelnen Repositories.
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GitLog Analysis";
  workbook.created = new Date();

  addAllCommitsSheet(workbook, "Commits", [
    { repoName, data: commits, skipFirstCommit },
  ]);

  await workbook.xlsx.writeFile(filename);
  console.log(`✓ Repo-Commits-Datei gespeichert: ${filename}`);
}

function addCriteriaSheet(
  workbook: ExcelJS.Workbook,
  data: {
    rows: CriteriaRow[];
    deadline: Date;
    plannedHours: number;
    thresholds: MetricThresholds;
  },
): void {
  const sheet = workbook.addWorksheet("Kriterien-Übersicht");

  // Dieses Sheet fasst pro Autor die wichtigsten Kriterien und Auffaelligkeiten zusammen.
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
    // Jede CriteriaRow wird in eine Excel-Zeile mit formatierten Prozentwerten umgewandelt.
    const newRow = sheet.addRow({
      author: row.author,
      total_commits: row.totalCommits,
      mixed_commits: formatWithPercent(row.totalCommits, row.totalMixedCommits),
      source_commits: formatWithPercent(
        row.totalCommits,
        row.totalSourceCommits,
      ),
      test_commits: formatWithPercent(row.totalCommits, row.totalTestCommits),
      comment_commits: formatWithPercent(
        row.totalCommits,
        row.totalCommentCommits,
      ),
      total_changes: formatWithPercent(row.totalChanges, row.totalChanges),
      source_changes: formatWithPercent(
        row.totalChanges,
        row.totalSourceChanges,
      ),
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
        getDayAndTimeFromDate(data.deadline).day +
        " " +
        getDayAndTimeFromDate(data.deadline).time,
      sessions: row.totalSessions,
      avg_commits: row.averageCommitsPerSession,
      avg_changes: row.averageChangesPerHourOverSessions,
      // index: calculateIndex(row, weights, data.thresholds, data.deadline, data.plannedHours),
      index: calculateIndex(
        row,
        myWeights,
        data.thresholds,
        data.deadline,
        data.plannedHours,
      ),
    });

    /**
     * Promt: wie kann ich so machen, dass bei export excel sheet manche sachen mit roter Farbe markiert werden? Also das würde ich für besseren Übersicht den Auffälligkeiten machen
     */
    // Rote Markierung für Auffälligkeiten
    const redFill = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFFF6B6B" },
    };

    // Die folgenden Bedingungen markieren genau die Kennzahlen rot,
    // die auch fuer den Auffaelligkeitsindex relevant sind.
    // Zu wenige Commits
    if (row.areFewCommits) {
      newRow.getCell("total_commits").fill = redFill;
    }

    // Zu wenige Changes
    if (row.areFewChanges) {
      newRow.getCell("total_changes").fill = redFill;
    }

    // Zu wenige Test Changes
    if (row.areFewChangesInTests) {
      newRow.getCell("test_changes").fill = redFill;
    }

    // Hoher Bundling-Koeffizient (verdächtig)
    if (row.isBundled) {
      newRow.getCell("bundling").fill = redFill;
    }

    // Erster Commit am Deadline-Tag
    if (row.firstCommitOnDeadline) {
      newRow.getCell("start_date").fill = redFill;
    }

    // Zu später Start (innerhalb der letzten geplanten Stunden)
    if (isTooLateFirstCommit(row.startDate, data.deadline, data.plannedHours)) {
      newRow.getCell("start_date").fill = redFill;
    }

    // Zu hohe Changes pro Stunde
    if (
      row.averageChangesPerHourOverSessions >= data.thresholds.avgChangesPerHour
    ) {
      newRow.getCell("avg_changes").fill = redFill;
    }

    // Wenig Mixed Commits kann darauf hindeuten, dass Arbeit stark getrennt
    // oder nur in bestimmten Bereichen geleistet wurde.
    if (row.totalMixedCommits / row.totalCommits <= 0.5) {
      newRow.getCell("mixed_commits").fill = redFill;
    }

    // Hoher Index (mehrere Auffälligkeiten)
    const indexValue = calculateIndex(
      row,
      myWeights,
      data.thresholds,
      data.deadline,
      data.plannedHours,
    );
    if (indexValue > 0.5) {
      newRow.getCell("index").fill = redFill;
      newRow.getCell("index").font = { bold: true };
    }
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

  // Dieses Sheet enthaelt alle Sessions aus allen Repositories in einer Tabelle.
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
    // Jede Session bekommt den Repository-Namen, damit sie spaeter zuordenbar bleibt.
    sessionData.data.forEach((s) => {
      sheet.addRow({
        repository: sessionData.repoName,
        author: s.author,
        session_index: s.sessionIndex,
        commits: s.totalCommits,
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
  commitsByRepo: {
    repoName: string;
    data: CommitWithDiff[];
    skipFirstCommit: boolean;
  }[],
): void {
  const sheet = workbook.addWorksheet(sheetName);

  // Dieses Sheet enthaelt alle Commit-Zeilen mit Code-, Kommentar- und Testaenderungen.
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
    // Commits werden pro Repository eingetragen; der Hash wird fuer bessere Lesbarkeit gekuerzt.
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

    // Leerzeilen trennen die Repository-Bloecke optisch voneinander.
    sheet.addRow({});

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

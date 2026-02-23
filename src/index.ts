import { analyzeRepo } from "./analysis";
import { calculateMetricThresholds } from "./calculations";
import { askCliInput } from "./cli";
import { exportGitLogs, getGitLogs } from "./export_git_logs";
import {
  buildCriteriaRows,
  printCommitsTable,
  printCriteriaTable,
  exportToExcel,
} from "./reporting";
import { AuthorAggregation, ExcelExportData } from "./types";
import {
  calculateAvaregeChangesPerHourOverSessions,
  findGitRepos,
  mergeAuthorMaps,
} from "./utils";

async function main() {
  const repoName = "sample1";

  const cli = await askCliInput(repoName);

  const repoDirs = await findGitRepos(cli.repoPath);
  console.log("\nRepository:", cli.repoPath);
  console.log(
    "Deadline:",
    cli.deadline.toLocaleDateString("de-DE") +
      " " +
      cli.deadline.toLocaleTimeString("de-DE"),
  );
  console.log("Untere Grenze für Commits: ", cli.commitThreshold);
  console.log("Geschätzte Aufwand in Stunden: ", cli.estimatedEffort);
  // await exportGitLogs(repoDirs);

  const totalCommitssPerRepo: number[] = [];
  const students = new Map<string, AuthorAggregation>();

  // Prompt: ich gebe mehrere tabellen in terminal aus. Wie könnte ich das ganze irgendwie in einer Excel-Datei exportieren / speichern mit hilfe von exceljs?
  // Daten für Excel-Export sammeln
  const excelData: ExcelExportData = {
    commits: [],
    sessions: [],
    criteria: {
      rows: [],
      deadline: cli.deadline,
      plannedHours: cli.estimatedEffort,
      thresholds: { totalCommits: 0, totalChanges: 0, totalTestChanges: 0, avgChangesPerHour: 0, bundling: 0 } // wird später gesetzt
    },
  };

  for (const repo of repoDirs) {
    const { commitsWithDiff, authors, sessions } = await analyzeRepo(
      repo,
      cli.skipFirstCommit,
    );
    const nonTesttotalCommits = commitsWithDiff.filter(
      (c) => c.totalSourceChanges > 0 || c.totalCommentChanges > 0,
    ).length;
    let idx = 0;
    console.log(
      "Diff: ",
      commitsWithDiff[idx].author,
      " ",
      commitsWithDiff.length,
    );
    console.log("nontestCommitLength : ", nonTesttotalCommits);
    totalCommitssPerRepo.push(nonTesttotalCommits);
    mergeAuthorMaps(students, authors);
    printCommitsTable(commitsWithDiff, cli.skipFirstCommit);
    console.log("Durschnittliche Anzahl von Änderungen pro Stunde", calculateAvaregeChangesPerHourOverSessions(sessions, cli.skipFirstCommit));
    console.table(
      sessions.map((s) => ({
        author: s.author,
        session_index: s.sessionIndex,
        commits: s.totalCommits,
        duration_min: s.durationMinutes,
        total_changes: s.totalChanges,
        changes_hour: s.changesPerHour ?? 0,
      })),
    );
    console.log("---------");

    // Prompt: ich gebe mehrere tabellen in terminal aus. Wie könnte ich das ganze irgendwie in einer Excel-Datei exportieren / speichern mit hilfe von exceljs?
    // Daten für Excel sammeln
    const repoDisplayName = repo.split('/').pop() || `repo_${idx}`;
    excelData.commits.push({
      repoName: repoDisplayName,
      data: commitsWithDiff,
      skipFirstCommit: cli.skipFirstCommit,
    });
    excelData.sessions.push({
      repoName: repoDisplayName,
      data: sessions,
    });

    idx++;
  }

  // Berechne alle Schwellwerte gebündelt
  const thresholds = calculateMetricThresholds(students, cli.commitThreshold, 1);

  const criteriaRows = buildCriteriaRows(
    students,
    thresholds,
    cli.skipFirstCommit,
    cli.deadline,
  );

  console.log("\n=== Schwellwerte ===");
  console.log("Commits:", thresholds.totalCommits);
  console.log("Total Changes:", thresholds.totalChanges);
  console.log("Total Test Changes:", thresholds.totalTestChanges);
  console.log("Avg Changes/h:", thresholds.avgChangesPerHour.toFixed(2));

  printCriteriaTable(criteriaRows, thresholds, cli.deadline, cli.estimatedEffort, repoName);

  // Prompt: ich gebe mehrere tabellen in terminal aus. Wie könnte ich das ganze irgendwie in einer Excel-Datei exportieren / speichern mit hilfe von exceljs?
  // Criteria-Daten für Excel setzen
  excelData.criteria.rows = criteriaRows;
  excelData.criteria.thresholds = thresholds;
  // Excel-Export
  const excelFilename = `analysis_${repoName}.xlsx`;
  await exportToExcel(excelData, excelFilename);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

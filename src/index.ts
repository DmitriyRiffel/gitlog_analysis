import { analyzeRepo } from "./analysis";
import { askCliInput } from "./cli";
import { exportGitLogs, getGitLogs } from "./export_git_logs";
import {
  buildCriteriaRows,
  printCommitsTable,
  printCriteriaTable,
  exportToExcel,
  ExcelExportData,
} from "./reporting";
import { AuthorAggregation } from "./types";
import {
  calculateAvaregeChangesPerHourOverSessions,
  calculateLowerMadThreshold,
  findGitRepos,
  mergeAuthorMaps,
} from "./utils";

async function main() {
  const repoName = "sample4";

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

  const commitCountsPerRepo: number[] = [];
  const students = new Map<string, AuthorAggregation>();

  // Prompt: ich gebe mehrere tabellen in terminal aus. Wie könnte ich das ganze irgendwie in einer Excel-Datei exportieren / speichern mit hilfe von exceljs?
  // Daten für Excel-Export sammeln
  const excelData: ExcelExportData = {
    commits: [],
    sessions: [],
    criteria: { rows: [], deadline: cli.deadline, plannedHours: cli.estimatedEffort },
  };

  for (const repo of repoDirs) {
    const { commitsWithDiff, authors, sessions } = await analyzeRepo(
      repo,
      cli.skipFirstCommit,
    );
    const nonTestCommitCount = commitsWithDiff.filter(
      (c) => c.totalSourceChanges > 0 || c.totalCommentChanges > 0,
    ).length;
    let idx = 0;
    console.log(
      "Diff: ",
      commitsWithDiff[idx].author,
      " ",
      commitsWithDiff.length,
    );
    console.log("nontestCommitLength : ", nonTestCommitCount);
    commitCountsPerRepo.push(nonTestCommitCount);
    mergeAuthorMaps(students, authors);
    printCommitsTable(commitsWithDiff, cli.skipFirstCommit);
    console.log("Durschnittliche Anzahl von Änderungen pro Stunde", calculateAvaregeChangesPerHourOverSessions(sessions, cli.skipFirstCommit));
    console.table(
      sessions.map((s) => ({
        author: s.author,
        session_index: s.sessionIndex,
        commits: s.commitCount,
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

  const authorTotalChanges = Array.from(students.values()).map(
    (a) => a.totalChanges,
  );
  const authorTotalChangesInTests = Array.from(students.values()).map(
    (a) => a.totalTestChanges,
  );

  const thresholdTotalChanges = calculateLowerMadThreshold(
    authorTotalChanges,
    2,
  );
  const thresholdTotalChangesInTests = calculateLowerMadThreshold(
    authorTotalChangesInTests,
    2,
  );

  const criteriaRows = buildCriteriaRows(
    students,
    cli.commitThreshold,
    thresholdTotalChanges,
    thresholdTotalChangesInTests,
    cli.skipFirstCommit,
    cli.deadline,
  );
  let count: number = 0;
  for (const changes of authorTotalChanges) {
    count += changes;
  }
  console.log("Untere Grenze für Commits:", cli.commitThreshold);
  console.log(
    "Untere Grenze für Changes:",
    thresholdTotalChanges,
    "Mittelwert:",
    count / authorTotalChanges.length,
  );
  console.log(
    "Untere Grenze für Tests-Änderungen",
    thresholdTotalChangesInTests,
  );
  printCriteriaTable(criteriaRows, cli.deadline, cli.estimatedEffort, repoName);

  // Prompt: ich gebe mehrere tabellen in terminal aus. Wie könnte ich das ganze irgendwie in einer Excel-Datei exportieren / speichern mit hilfe von exceljs?
  // Criteria-Daten für Excel setzen
  excelData.criteria.rows = criteriaRows;
  // Excel-Export
  // const excelFilename = `analysis_${repoName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  const excelFilename = `testname.xlsx`;
  await exportToExcel(excelData, excelFilename);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

import { analyzeRepo } from "./analysis";
import { askCliInput } from "./cli";
import { exportGitLogs, getGitLogs } from "./export_git_logs";
import {
  buildCriteriaRows,
  printCommitsTable,
  printCriteriaTable,
} from "./reporting";
import { AuthorAggregation } from "./types";
import {
  calculateLowerMadThreshold,
  findGitRepos,
  mergeAuthorMaps,
} from "./utils";

async function main() {
  const cli = await askCliInput();

  const rootDir = "F:/Hochschule/BA/sample1";
  const repoDirs = await findGitRepos(cli.repoPath);
  // const repoDirs = await findGitRepos(rootDir);
  console.log("\nRepository:", cli.repoPath);
  console.log(
    "Deadline:",
    cli.deadline.toLocaleDateString("de-DE") +
      " " +
      cli.deadline.toLocaleTimeString("de-DE")
  );
  console.log("Untere Grenze für Commits: ", cli.commitThresholdMultiplier);
  console.log("Geschätzte Aufwand in Stunden: ", cli.estimatedEffort);
  // await exportGitLogs(repoDirs);

  const commitCountsPerRepo: number[] = [];
  const students = new Map<string, AuthorAggregation>();

  for (const repo of repoDirs) {
    const { commitsWithDiff, authors, sessions } = await analyzeRepo(repo);
    const nonTestCommitCount = commitsWithDiff.filter(
      (c) => c.totalChanges > 0 || c.totalCommentChanges > 0
    ).length;
    let idx = 0;
    console.log(
      "Diff: ",
      commitsWithDiff[idx].author,
      " ",
      commitsWithDiff.length
    );
    console.log("nontestCommitLength : ", nonTestCommitCount);
    commitCountsPerRepo.push(nonTestCommitCount);
    mergeAuthorMaps(students, authors);
    printCommitsTable(commitsWithDiff);
    console.table(
      sessions.map((s) => ({
        author: s.author,
        session_index: s.sessionIndex,
        commits: s.commitCount,
        duration_min: s.durationMinutes,
        total_changes: s.totalChanges,
        changes_hour: s.changesPerHour ?? 0,
      }))
    );
    console.log("---------");
    idx++;
  }

  const authorTotalChanges = Array.from(students.values()).map(
    (a) => a.totalChanges
  );
  const authorTotalChangesInTests = Array.from(students.values()).map(
    (a) => a.totalChangesInTests
  );

  const thresholdCommitCount = calculateLowerMadThreshold(
    commitCountsPerRepo,
    cli.commitThresholdMultiplier
  );
  const thresholdTotalChanges = calculateLowerMadThreshold(
    authorTotalChanges,
    1.5
  );
  const thresholdTotalChangesInTests = calculateLowerMadThreshold(
    authorTotalChangesInTests,
    2
  );

  const criteriaRows = buildCriteriaRows(
    students,
    thresholdCommitCount,
    thresholdTotalChanges,
    thresholdTotalChangesInTests,
    cli.deadline
  );
  let count: number = 0;
  for (const changes of authorTotalChanges) {
    count += changes;
  }
  console.log("Untere Grenze für Commits:", thresholdCommitCount);
  console.log(
    "Untere Grenze für Changes:",
    thresholdTotalChanges,
    "Mittelwert:",
    count / authorTotalChanges.length
  );
  console.log(
    "Untere Grenze für Tests-Änderungen",
    thresholdTotalChangesInTests
  );
  printCriteriaTable(criteriaRows, cli.deadline, cli.estimatedEffort);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

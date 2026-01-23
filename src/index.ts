import { analyzeRepo } from "./analysis";
import { askCliInput } from "./cli";
import { exportGitLogs, getGitLogs } from "./export_git_logs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  buildCriteriaRows,
  printCommitsTable,
  printCriteriaTable,
} from "./reporting";
import { AuthorAggregation } from "./types";
import {
  calculateCommitBundling,
  calculateLowerMadThreshold,
  findGitRepos,
  mergeAuthorMaps,
} from "./utils";

async function main() {
  const repoName = "sample1";
  const skipFirstCommit = false;

  const cli = await askCliInput(repoName);

  const repoDirs = await findGitRepos(cli.repoPath);
  console.log("\nRepository:", cli.repoPath);
  console.log(
    "Deadline:",
    cli.deadline.toLocaleDateString("de-DE") +
      " " +
      cli.deadline.toLocaleTimeString("de-DE"),
  );
  console.log("Untere Grenze für Commits: ", cli.commitThresholdMultiplier);
  console.log("Geschätzte Aufwand in Stunden: ", cli.estimatedEffort);
  await exportGitLogs(repoDirs);

  const commitCountsPerRepo: number[] = [];
  const students = new Map<string, AuthorAggregation>();

  for (const repo of repoDirs) {
    const { commitsWithDiff, authors, sessions } = await analyzeRepo(
      repo,
      skipFirstCommit,
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
    printCommitsTable(commitsWithDiff, skipFirstCommit);
    console.table(
      sessions.map((s) => ({
        author: s.author,
        session_index: s.sessionIndex,
        commits: s.commitCount,
        duration_min: s.durationMinutes,
        total_changes: s.totalSourceChanges,
        changes_hour: s.changesPerHour ?? 0,
      })),
    );
    console.log("---------");
    idx++;
  }

  const authortotalSourceChanges = Array.from(students.values()).map(
    (a) => a.totalSourceChanges,
  );
  const authortotalSourceChangesInTests = Array.from(students.values()).map(
    (a) => a.totalTestChanges,
  );

  const thresholdCommitCount = calculateLowerMadThreshold(
    commitCountsPerRepo,
    cli.commitThresholdMultiplier,
  );
  const thresholdtotalSourceChanges = calculateLowerMadThreshold(
    authortotalSourceChanges,
    1.5,
  );
  const thresholdtotalSourceChangesInTests = calculateLowerMadThreshold(
    authortotalSourceChangesInTests,
    2,
  );

  const criteriaRows = buildCriteriaRows(
    students,
    thresholdCommitCount,
    thresholdtotalSourceChanges,
    thresholdtotalSourceChangesInTests,
    cli.deadline,
  );
  let count: number = 0;
  for (const changes of authortotalSourceChanges) {
    count += changes;
  }
  console.log("Untere Grenze für Commits:", thresholdCommitCount);
  console.log(
    "Untere Grenze für Changes:",
    thresholdtotalSourceChanges,
    "Mittelwert:",
    count / authortotalSourceChanges.length,
  );
  console.log(
    "Untere Grenze für Tests-Änderungen",
    thresholdtotalSourceChangesInTests,
  );
  printCriteriaTable(criteriaRows, cli.deadline, cli.estimatedEffort, repoName);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

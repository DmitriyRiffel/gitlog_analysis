import { analyzeRepo } from "./analysis";
import {
  buildCriteriaRows,
  printCommitsTable,
  printCriteriaTable,
} from "./reporting";
import { AuthorAggregation } from "./types";
import { findGitRepos, lowerMadThreshold, mad, median } from "./utils";

function mergeAuthorMaps(
  into: Map<string, AuthorAggregation>,
  from: Map<string, AuthorAggregation>
) {
  for (const [author, agg] of from.entries()) {
    const prev = into.get(author);
    if (!prev) {
      into.set(author, { ...agg });
      continue;
    }
  }
}

async function main() {
  const rootDir = "F:/Hochschule/BA/sample1";

  const repoDirs = await findGitRepos(rootDir);
  console.log(`Gefundene Repos: ${repoDirs.length}`);

  const commitCountsPerRepo: number[] = [];
  const students = new Map<string, AuthorAggregation>();

  for (const repo of repoDirs) {
    const { commitsWithDiff, authors, sessions } = await analyzeRepo(repo);

    commitCountsPerRepo.push(commitsWithDiff.length);
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
  }

  const medianCommitCounts = median(commitCountsPerRepo);
  const madCommitCounts = mad(commitCountsPerRepo);
  const thresholdCommitCounts = lowerMadThreshold(
    medianCommitCounts,
    madCommitCounts,
    2
  );

  const authorTotalChanges = Array.from(students.values()).map(
    (a) => a.totalChanges
  );

  const medianTotalChanges = median(authorTotalChanges);
  const madTotalChanges = mad(authorTotalChanges);
  const thresholdTotalChanges = lowerMadThreshold(
    medianTotalChanges,
    madTotalChanges,
    1.5
  );

  const criteriaRows = buildCriteriaRows(
    students,
    thresholdCommitCounts,
    thresholdTotalChanges
  );
  let count: number = 0;
  for (const changes of authorTotalChanges) {
    count += changes;
  }
  console.log("Anzahl von commits: ", commitCountsPerRepo);
  console.log(
    "Median:",
    medianCommitCounts,
    "MAD:",
    madCommitCounts,
    "threshold:",
    thresholdCommitCounts
  );
  console.log(
    "TotalChanges per Autor:",
    authorTotalChanges,
    "Median:",
    medianTotalChanges,
    "MAD:",
    madTotalChanges,
    "LowerThreshold:",
    thresholdTotalChanges,
    "Mittelwert:",
    count / authorTotalChanges.length
  );
  printCriteriaTable(criteriaRows);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

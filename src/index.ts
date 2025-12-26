import { analyzeRepo, mad, median, lowerMadThreshold } from "./analysis";
import {
  buildCriteriaRows,
  printCommitsTable,
  printCriteriaTable,
} from "./reporting";
import { AuthorAggregation } from "./types";
import { findGitRepos } from "./utils";

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

    prev.commitCount += agg.commitCount;
    prev.totalInsertions += agg.totalInsertions;
    prev.totalDeletions += agg.totalDeletions;
    prev.totalChanges += agg.totalChanges;

    if (agg.firstCommitAt < prev.firstCommitAt) {
      prev.firstCommitAt = agg.firstCommitAt;
      prev.firstCommitHash = agg.firstCommitHash;
    }
    if (agg.lastCommitAt > prev.lastCommitAt) {
      prev.lastCommitAt = agg.lastCommitAt;
    }
  }
}

async function main() {
  const rootDir = "F:/Hochschule/BA/sample1";

  const repoDirs = await findGitRepos(rootDir);
  console.log(`Gefundene Repos: ${repoDirs.length}`);

  const commitCountsPerRepo: number[] = [];
  const globalAuthors = new Map<string, AuthorAggregation>();

  for (const repo of repoDirs) {
    const { commitsWithDiff, authors } = analyzeRepo(repo);

    commitCountsPerRepo.push(commitsWithDiff.length);
    mergeAuthorMaps(globalAuthors, authors);
    printCommitsTable(commitsWithDiff);
  }

  const medianCommitCounts = median(commitCountsPerRepo);
  const madCommitCounts = mad(commitCountsPerRepo);
  const thresholdCommitCounts = lowerMadThreshold(
    medianCommitCounts,
    madCommitCounts,
    2
  );

  const authorTotalChanges = Array.from(globalAuthors.values()).map(
    (a) => a.totalChanges
  );

  const medianTotalChanges = median(authorTotalChanges);
  const madTotalChanges = mad(authorTotalChanges);
  const thresholdTotalChanges = lowerMadThreshold(
    medianTotalChanges,
    madTotalChanges,
    1.5
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

  const criteriaRows = buildCriteriaRows(
    globalAuthors,
    thresholdCommitCounts,
    thresholdTotalChanges
  );
  printCriteriaTable(criteriaRows);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

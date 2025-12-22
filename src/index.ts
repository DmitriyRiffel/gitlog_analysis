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

  const med = median(commitCountsPerRepo);
  const madVal = mad(commitCountsPerRepo);
  const threshold = lowerMadThreshold(med, madVal, 2);

  console.log("Anzahl von commits: ", commitCountsPerRepo);
  console.log("Median:", med, "MAD:", madVal, "threshold:", threshold);

  const criteriaRows = buildCriteriaRows(globalAuthors, threshold);
  printCriteriaTable(criteriaRows);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

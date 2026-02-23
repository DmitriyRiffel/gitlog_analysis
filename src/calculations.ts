import { AuthorAggregation, MetricThresholds } from "./types";

function calculateMedian(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }

  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateMad(values: number[]): number {
  const med = calculateMedian(values);
  const deviations = values.map((v) => Math.abs(v - med));

  return calculateMedian(deviations);
}

export function calculateLowerMadThreshold(
  values: number[],
  k: number = 2,
): number {
  const median = calculateMedian(values);
  const mad = calculateMad(values);
  const threshold = Math.max(0, median - k * mad);
  console.log(`Lower Threshold: median=${median} - ${k}*mad(${mad.toFixed(2)}) = ${(median - k * mad).toFixed(2)} → ${threshold.toFixed(2)}`);
  return threshold;
}

export function calculateUpperMadThreshold(
  values: number[],
  k: number = 2,
): number {
  const median = calculateMedian(values);
  const mad = calculateMad(values);
  return median + k * mad;
}

/**
 * Prompt: Kannst du mir machen, dass alle Schwellenwerte in einer Methode berechnet werden
 * Berechnet alle Schwellwerte für Metriken über alle Autoren/Repos hinweg
 */
export function calculateMetricThresholds(
  students: Map<string, AuthorAggregation>,
  commitThreshold: number,
  k: number = 2,
): MetricThresholds {
  const authorsArray = Array.from(students.values());

  // Total Changes (untere Grenze)
  const authorTotalChanges = authorsArray.map((a) => a.totalChanges);
  const thresholdTotalChanges = calculateLowerMadThreshold(authorTotalChanges, k);

  // Total Test Changes (untere Grenze)
  const authorTotalChangesInTests = authorsArray.map((a) => a.totalTestChanges);
  const thresholdTotalChangesInTests = calculateLowerMadThreshold(
    authorTotalChangesInTests,
    k,
  );

  // Average Changes Per Hour (obere Grenze)
  const authorAvgChangesPerHour = authorsArray.map(
    (a) => a.avaregeChangesPerHourOverSessions,
  );
  const thresholdAvgChangesPerHour = calculateUpperMadThreshold(
    authorAvgChangesPerHour,
    k,
  );

  // Bundling (obere Grenze) - nur für Authors mit genug Commits
  const authorsBundlingWithEnoughCommits = authorsArray
    .filter((a) => a.totalCommits >= commitThreshold)
    .map((a) => a.bundling_coeff);
  const thresholdBundling = authorsBundlingWithEnoughCommits.length > 0
    ? calculateUpperMadThreshold(authorsBundlingWithEnoughCommits, k)
    : 0.5;

  console.log("\n=== Berechnung der Schwellwerte ===");
  console.log(`totalChanges Schwellwert: ${thresholdTotalChanges.toFixed(2)}`);
  console.log(`totalTestChanges Schwellwert:   ${thresholdTotalChangesInTests.toFixed(2)}`);
  console.log(`avgChangesPerHour Schwellwert:  ${thresholdAvgChangesPerHour.toFixed(2)}`);
  console.log(`bundling Schwellwert:            ${thresholdBundling.toFixed(4)}`);

  return {
    totalCommits: commitThreshold,
    totalChanges: thresholdTotalChanges,
    totalTestChanges: thresholdTotalChangesInTests,
    avgChangesPerHour: thresholdAvgChangesPerHour,
    bundling: thresholdBundling,
  };
}

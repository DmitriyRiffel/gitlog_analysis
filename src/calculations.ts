import { AuthorAggregation, MetricThresholds } from "./types";

/**
 * Berechnet alle Schwellwerte für Metriken über alle Autoren/Repos hinweg
 */
export function calculateMetricThresholds(
  students: Map<string, AuthorAggregation>,
  commitThreshold: number,
  k: number = 2,
): MetricThresholds {
  const authorsArray = Array.from(students.values());

  // Total Source Changes (untere Grenze)
  const authorTotalChanges = authorsArray.map((a) => a.totalSourceChanges);
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

  return {
    commitCount: commitThreshold,
    totalSourceChanges: thresholdTotalChanges,
    totalTestChanges: thresholdTotalChangesInTests,
    avgChangesPerHour: thresholdAvgChangesPerHour,
  };
}

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
  return median - k * mad;
}

export function calculateUpperMadThreshold(
  values: number[],
  k: number = 2,
): number {
  const median = calculateMedian(values);
  const mad = calculateMad(values);
  return median + k * mad;
}

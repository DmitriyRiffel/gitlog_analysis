import { AuthorAggregation, CriteriaRow, MetricThresholds, MetricWeights, Session } from "./types";

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

export function calculateMetricWeights(
  rows: CriteriaRow[],
  thresholds: MetricThresholds,
  deadline: Date,
  plannedHours: number,
): MetricWeights {
  const totalRepos = rows.length;

  // Zähle wie viele Repos die Metrik erfüllen
  const countFirstCommitOnDeadline = rows.filter((r) => r.firstCommitOnDeadline).length;
  const countAreFewChanges = rows.filter((r) => r.areFewChanges).length;
  const countAreFewChangesInTests = rows.filter((r) => r.areFewChangesInTests).length;
  const countAreFewCommits = rows.filter((r) => r.totalCommits <= thresholds.totalCommits).length;
  const countIsTooLateFirstCommit = rows.filter((r) =>
    isTooLateFirstCommit(r.startDate, deadline, plannedHours)
  ).length;
  const countChangesPerHour = rows.filter((r) => r.avaregeChangesPerHourOverSessions >= thresholds.avgChangesPerHour).length;
  const countIsBundled = rows.filter((r) => r.isBundled).length;

  // Berechne Anteile (p_i)
  const pFirstCommitOnDeadline = countFirstCommitOnDeadline / totalRepos;
  const pAreFewChanges = countAreFewChanges / totalRepos;
  const pAreFewChangesInTests = countAreFewChangesInTests / totalRepos;
  const pAreFewCommits = countAreFewCommits / totalRepos;
  const pIsTooLateFirstCommit = countIsTooLateFirstCommit / totalRepos;
  const pChangesPerHour = countChangesPerHour / totalRepos;
  const pIsBundled = countIsBundled / totalRepos;

  // Berechne unormalisierte Gewichte: w = p(1-p)
  const wFirstCommitOnDeadline = pFirstCommitOnDeadline * (1 - pFirstCommitOnDeadline);
  const wAreFewChanges = pAreFewChanges * (1 - pAreFewChanges);
  const wAreFewChangesInTests = pAreFewChangesInTests * (1 - pAreFewChangesInTests);
  const wAreFewCommits = pAreFewCommits * (1 - pAreFewCommits);
  const wIsTooLateFirstCommit = pIsTooLateFirstCommit * (1 - pIsTooLateFirstCommit);
  const wChangesPerHour = pChangesPerHour * (1 - pChangesPerHour);
  const wIsBundled = pIsBundled * (1 - pIsBundled);

  // Summe aller Gewichte
  const sumWeights =
    wFirstCommitOnDeadline +
    wAreFewChanges +
    wAreFewChangesInTests +
    wAreFewCommits +
    wIsTooLateFirstCommit +
    wChangesPerHour +
    wIsBundled;

   // Konsolenausgabe zur Nachvollziehbarkeit
  console.log("\n=== Metrik-Gewichtsberechnung ===");
  console.log(`Gesamtanzahl Repos: ${totalRepos}`);
  console.log("\n--- Schwellwerte ---");
  console.log(`Commits:              ${thresholds.totalCommits}`);
  console.log(`Total Changes: ${thresholds.totalChanges}`);
  console.log(`Total Test Changes:   ${thresholds.totalTestChanges}`);
  console.log(`Avg Changes/h:        ${thresholds.avgChangesPerHour.toFixed(2)}`);
  console.log(`Bundling Threshold:   ${thresholds.bundling.toFixed(4)}`);
  console.log("\n--- Anzahl auffälliger Repos pro Metrik ---");
  console.log(`firstCommitOnDeadline:   ${countFirstCommitOnDeadline} von ${totalRepos} (${(pFirstCommitOnDeadline * 100).toFixed(1)}%)`);
  console.log(`areFewChanges:           ${countAreFewChanges} von ${totalRepos} (${(pAreFewChanges * 100).toFixed(1)}%)`);
  console.log(`areFewChangesInTests:    ${countAreFewChangesInTests} von ${totalRepos} (${(pAreFewChangesInTests * 100).toFixed(1)}%)`);
  console.log(`areFewCommits (≤${thresholds.totalCommits}):     ${countAreFewCommits} von ${totalRepos} (${(pAreFewCommits * 100).toFixed(1)}%)`);
  console.log(`isTooLateFirstCommit:    ${countIsTooLateFirstCommit} von ${totalRepos} (${(pIsTooLateFirstCommit * 100).toFixed(1)}%)`);
  console.log(`changesPerHour (≥${thresholds.avgChangesPerHour.toFixed(2)}): ${countChangesPerHour} von ${totalRepos} (${(pChangesPerHour * 100).toFixed(1)}%)`);
  console.log(`isBundled (commits≥${thresholds.totalCommits} && bundling≥${thresholds.bundling.toFixed(4)}): ${countIsBundled} von ${totalRepos} (${(pIsBundled * 100).toFixed(1)}%)`);

  console.log(`\nwFirstCommitOnDeadline:  ${wFirstCommitOnDeadline.toFixed(4)}`);
  console.log(`wAreFewChanges:          ${wAreFewChanges.toFixed(4)}`);
  console.log(`wAreFewChangesInTests:   ${wAreFewChangesInTests.toFixed(4)}`);
  console.log(`wAreFewCommits:          ${wAreFewCommits.toFixed(4)}`);
  console.log(`wIsTooLateFirstCommit:   ${wIsTooLateFirstCommit.toFixed(4)}`);
  console.log(`wChangesPerHour:         ${wChangesPerHour.toFixed(4)}`);
  console.log(`wIsBundled:              ${wIsBundled.toFixed(4)}`);
  console.log(`Summe:                   ${sumWeights.toFixed(4)}`);

  const normalizedWeights = {
    firstCommitOnDeadline: wFirstCommitOnDeadline / sumWeights,
    areFewChanges: wAreFewChanges / sumWeights,
    areFewChangesInTests: wAreFewChangesInTests / sumWeights,
    areFewCommits: wAreFewCommits / sumWeights,
    isTooLateFirstCommit: wIsTooLateFirstCommit / sumWeights,
    changesPerHour: wChangesPerHour / sumWeights,
    isBundled: wIsBundled / sumWeights
  };

  console.log("\n--- Normalisierte Gewichte ---");
  console.log(`firstCommitOnDeadline:   ${normalizedWeights.firstCommitOnDeadline.toFixed(4)} (${(normalizedWeights.firstCommitOnDeadline * 100).toFixed(1)}%)`);
  console.log(`areFewChanges:           ${normalizedWeights.areFewChanges.toFixed(4)} (${(normalizedWeights.areFewChanges * 100).toFixed(1)}%)`);
  console.log(`areFewChangesInTests:    ${normalizedWeights.areFewChangesInTests.toFixed(4)} (${(normalizedWeights.areFewChangesInTests * 100).toFixed(1)}%)`);
  console.log(`areFewCommits:           ${normalizedWeights.areFewCommits.toFixed(4)} (${(normalizedWeights.areFewCommits * 100).toFixed(1)}%)`);
  console.log(`isTooLateFirstCommit:    ${normalizedWeights.isTooLateFirstCommit.toFixed(4)} (${(normalizedWeights.isTooLateFirstCommit * 100).toFixed(1)}%)`);
  console.log(`changesPerHour:          ${normalizedWeights.changesPerHour.toFixed(4)} (${(normalizedWeights.changesPerHour * 100).toFixed(1)}%)`);
  console.log(`isBundled:               ${normalizedWeights.isBundled.toFixed(4)} (${(normalizedWeights.isBundled * 100).toFixed(1)}%)`);
  console.log("===================================\n");

  return normalizedWeights;
}

export function calculateIndex(
  row: CriteriaRow,
  weights: MetricWeights,
  thresholds: MetricThresholds,
  deadline: Date,
  plannedHours: number
): number {
  let index: number = 0;
  if (row.firstCommitOnDeadline) index += weights.firstCommitOnDeadline;
  if (row.areFewChanges) index += weights.areFewChanges;
  if (row.areFewChangesInTests) index += weights.areFewChangesInTests;
  if (row.areFewCommits) index += weights.areFewCommits;
  if (isTooLateFirstCommit(row.startDate, deadline, plannedHours))
    index += weights.isTooLateFirstCommit;
  if (row.avaregeChangesPerHourOverSessions >= thresholds.avgChangesPerHour)
    index += weights.changesPerHour;
  if (row.isBundled)
    index += weights.isBundled;
  return Number(index.toFixed(2));
}

function subtractHours(d: Date, hours: number): Date {
  return new Date(d.getTime() - hours * 60 * 60 * 1000);
}

export function isTooLateFirstCommit(
  firstCommitAt: Date,
  deadline: Date,
  plannedHours: number,
): boolean {
  /**
   *  const cutoffTime = subtractHours(deadline, plannedHours);
  const deadlineDay = getDayAndTimeFromDate(deadline).day;
  const commitDay = getDayAndTimeFromDate(firstCommitAt).day;

  // Nur relevant wenn am Deadline-Tag, sonst ist es zu spät/falsch
  return commitDay === deadlineDay && firstCommitAt > cutoffTime;
   */
  return firstCommitAt > subtractHours(deadline, plannedHours);
}

export function calculateAverageChangesPerHour(sessions: Session[]) {
  let temp = 0;
  let counter = 0;
  for (const s of sessions) {
    temp += s.changesPerHour ?? 0;
    counter++;
  }
  return temp / counter;
}

export function calculateAverageCommitsPerSession(sessions: Session[]) {
  let temp = 0;
  let counter = 0;
  for (const s of sessions) {
    temp += s.totalCommits;
    counter++;
  }
  return Number((temp / counter).toFixed(1));
}

/** Prompt: ich gebe mehrere tabellen in terminal aus. Wie könnte ich das ganze irgendwie in einer Excel-Datei exportieren / speichern mit hilfe von exceljs?
 * ----------------------
*/

import {
  AuthorAggregation,
  CriteriaRow,
  MetricThresholds,
  MetricWeights,
  Session,
} from "./types";

function calculateMedian(values: number[]) {
  // Fuer den Median muessen die Werte zuerst numerisch sortiert werden.
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    // Bei ungerader Anzahl liegt der Median genau in der Mitte.
    return sorted[mid];
  }

  // Bei gerader Anzahl wird der Durchschnitt der beiden mittleren Werte genutzt.
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateMad(values: number[]): number {
  // MAD = Median Absolute Deviation: typische Abweichung vom Median.
  const med = calculateMedian(values);
  const deviations = values.map((v) => Math.abs(v - med));

  return calculateMedian(deviations);
}

export function calculateLowerMadThreshold(
  values: number[],
  k: number = 2,
): number {
  // Unterer Schwellenwert: Werte deutlich unterhalb des Medians werden auffaellig.
  const median = calculateMedian(values);
  const mad = calculateMad(values);
  const threshold = Math.max(0, median - k * mad);
  console.log(
    `Lower Threshold: median=${median} - ${k}*mad(${mad.toFixed(2)}) = ${(median - k * mad).toFixed(2)} → ${threshold.toFixed(2)}`,
  );
  return threshold;
}

export function calculateUpperMadThreshold(
  values: number[],
  k: number = 2,
): number {
  // Oberer Schwellenwert: Werte deutlich oberhalb des Medians werden auffaellig.
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
  k: number,
): MetricThresholds {
  // Map-Werte werden in ein Array umgewandelt, damit die Metriken leichter
  // ueber alle Autoren hinweg gesammelt werden koennen.
  const authorsArray = Array.from(students.values());

  // Total Changes (untere Grenze)
  const authorTotalChanges = authorsArray.map((a) => a.totalChanges);
  const thresholdTotalChanges = calculateLowerMadThreshold(
    authorTotalChanges,
    k,
  );

  // Total Test Changes (untere Grenze)
  const authorTotalChangesInTests = authorsArray.map((a) => a.totalTestChanges);
  const thresholdTotalChangesInTests = calculateLowerMadThreshold(
    authorTotalChangesInTests,
    k,
  );

  // Average Changes Per Hour (obere Grenze)
  const authorAvgChangesPerHour = authorsArray.map(
    (a) => a.averageChangesPerHourOverSessions,
  );
  const thresholdAvgChangesPerHour = calculateUpperMadThreshold(
    authorAvgChangesPerHour,
    k,
  );

  // Bundling (obere Grenze) - nur für Authors mit genug Commits
  const authorsBundlingWithEnoughCommits = authorsArray
    .filter((a) => a.totalCommits >= commitThreshold)
    .map((a) => a.bundling_coeff);

  const thresholdBundling =
    authorsBundlingWithEnoughCommits.length > 0
      ? calculateUpperMadThreshold(authorsBundlingWithEnoughCommits, k)
      // Fallback, wenn keine Autorinnen/Autoren genug Commits fuer Bundling haben.
      : 0.5;

  console.log("\n=== Berechnung der Schwellwerte ===");
  console.log(`totalChanges Schwellwert: ${thresholdTotalChanges.toFixed(2)}`);
  console.log(
    `totalTestChanges Schwellwert:   ${thresholdTotalChangesInTests.toFixed(2)}`,
  );
  console.log(
    `avgChangesPerHour Schwellwert:  ${thresholdAvgChangesPerHour.toFixed(2)}`,
  );
  console.log(
    `bundling Schwellwert:            ${thresholdBundling.toFixed(4)}`,
  );

  return {
    totalCommits: commitThreshold,
    totalChanges: thresholdTotalChanges,
    totalTestChanges: thresholdTotalChangesInTests,
    avgChangesPerHour: thresholdAvgChangesPerHour,
    bundling: thresholdBundling,
  };
}

export function calculateIndex(
  row: CriteriaRow,
  manualWeights: MetricWeights,
  thresholds: MetricThresholds,
  deadline: Date,
  plannedHours: number,
): number {
  let index: number = 0;

  // Jede erfuellte Auffaelligkeit erhoeht den Index um ihr manuell gesetztes Gewicht.
  if (row.areFewChanges) index += manualWeights.areFewChanges;
  if (row.areFewChangesInTests) index += manualWeights.areFewChangesInTests;
  if (row.areFewCommits) index += manualWeights.areFewCommits;
  if (isTooLateFirstCommit(row.startDate, deadline, plannedHours))
    index += manualWeights.isTooLateFirstCommit;
  if (row.averageChangesPerHourOverSessions >= thresholds.avgChangesPerHour)
    index += manualWeights.changesPerHour;
  if (row.isBundled) index += manualWeights.isBundled;
  if (row.areFewMixedCommits) index += manualWeights.areFewMixedCommits;

  // Der Index wird auf zwei Nachkommastellen gerundet und maximal auf 1 begrenzt.
  return Math.min(1.0, Number(index.toFixed(2)));
}

function subtractHours(d: Date, hours: number): Date {
  // Rechnet Stunden in Millisekunden um und zieht sie vom Datum ab.
  return new Date(d.getTime() - hours * 60 * 60 * 1000);
}

export function isTooLateFirstCommit(
  firstCommitAt: Date,
  deadline: Date,
  plannedHours: number,
): boolean {
  // Der erste Commit gilt als zu spaet, wenn er nach dem spaetest sinnvollen
  // Startzeitpunkt liegt: Deadline minus geplante Arbeitsstunden.
  return firstCommitAt > subtractHours(deadline, plannedHours);
}

export function calculateAverageChangesPerHour(sessions: Session[]) {
  // Summiert die Aenderungen pro Stunde ueber alle Sessions und bildet den Mittelwert.
  let temp = 0;
  let counter = 0;
  for (const s of sessions) {
    temp += s.changesPerHour ?? 0;
    counter++;
  }
  return temp / counter;
}

export function calculateAverageCommitsPerSession(sessions: Session[]) {
  // Berechnet, wie viele Commits durchschnittlich in einer Session gemacht wurden.
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

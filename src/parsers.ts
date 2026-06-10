/**
 * Quellen:
 * - Git pretty formats (z. B. %H, %an, %ae, %ad, %s): https://git-scm.com/docs/git-log#_pretty_formats
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim
 */
/* Die Funktion zerlegt eine pipe-getrennte Commit-Zeile in ihre einzelnen Felder. */
export function splitCommitLinePipe(
  line: string,
): [string, string, string, string, string] {
  // commits.csv ist mit | getrennt, weil Commit-Nachrichten Kommas enthalten koennen.
  const parts = line.split("|");
  const hash = (parts[0] ?? "").trim();
  const author = (parts[1] ?? "").trim();
  const email = (parts[2] ?? "").trim();
  const date = (parts[3] ?? "").trim();
  // Falls der Commit-Betreff selbst ein | enthaelt, wird der Rest wieder zusammengesetzt.
  const subject = parts.slice(4).join("|").trim();
  return [hash, author, email, date, subject];
}

/**
 * Quellen:
 * - Git diff --numstat (maschinenlesbares Format): https://git-scm.com/docs/git-diff#_other_diff_formats
 * - 40-stellige Commit-Hashes / Revisionssyntax: https://git-scm.com/docs/git-rev-parse#_specifying_revisions
 * - Number-Konvertierung in JavaScript: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number
 */
/* Die Funktion wandelt eine Statistik-Zeile aus der CSV in ein strukturiertes Objekt um. */
export function parseFileStatLine(line: string): {
  hash: string;
  file: string;
  sourceInsertions: number;
  sourceDeletions: number;
  commentInsertions: number;
  commentDeletions: number;
} | null {
  // Erwartetes Format:
  // hash|file|sourceInsertions|sourceDeletions|commentInsertions|commentDeletions
  const parts = line.split("|");
  if (parts.length < 4) return null;

  const hash = parts[0].trim();
  const file = parts[1].trim();

  const insertionsStr = parts[2].trim();
  const deletionsStr = parts[3].trim();
  const commentInsertionsStr = parts[4].trim();
  const commentDeletionsStr = parts[5].trim();

  const sourceInsertions = Number(insertionsStr);
  const sourceDeletions = Number(deletionsStr);
  const commentInsertions = Number(commentInsertionsStr);
  const commentDeletions = Number(commentDeletionsStr);

  // Ungueltige oder unvollstaendige Zeilen werden verworfen.
  if (!/^[0-9a-f]{40}$/i.test(hash)) return null;
  if (!file) return null;
  if (
    !Number.isFinite(sourceInsertions) ||
    !Number.isFinite(sourceDeletions) ||
    !Number.isFinite(commentDeletions) ||
    !Number.isFinite(commentInsertions)
  )
    return null;

  return {
    hash,
    file,
    sourceInsertions,
    sourceDeletions,
    commentInsertions,
    commentDeletions,
  };
}

/**
 * Quellen:
 * - Git --numstat Ausgabe (added TAB deleted TAB path): https://git-scm.com/docs/git-diff#_other_diff_formats
 * - JavaScript split() mit Tab-Trennern: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split
 */
/* Die Funktion liest aus einer Git-numstat-Ausgabe alle Commit-Datei-Paare heraus. */
export function parseNumstat(text: string): { hash: string; file: string }[] {
  const commitFiles: { hash: string; file: string }[] = [];
  let currentHash: string | null = null;

  // Die Ausgabe wird zeilenweise gelesen; COMMIT:-Zeilen setzen den aktuellen Commit.
  for (const line of text.split("\n")) {
    if (line.startsWith("COMMIT:")) {
      currentHash = line.slice("COMMIT:".length).trim();
      continue;
    }
    if (!line.trim() || !currentHash) continue;

    // numstat-Zeilen bestehen aus: insertions<TAB>deletions<TAB>file.
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    // Dateinamen koennen theoretisch Tabs enthalten, daher wird alles ab Spalte 3 verbunden.
    const file = parts.slice(2).join("\t").trim();
    if (file) commitFiles.push({ hash: currentHash, file });
  }

  return commitFiles;
}

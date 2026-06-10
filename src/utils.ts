import * as fs from "node:fs";
import * as path from "node:path";
import {
  AuthorAggregation,
  COMMIT_TYPE_RULES,
  CommitType,
  CommitWithDiff,
  Session,
} from "./types";
import { runGit } from "./export_git_logs";

/* Die Funktion prueft, ob ein Pfad existiert und ein Ordner ist. */
export async function existsDir(p: string): Promise<boolean> {
  try {
    // Prueft, ob der Pfad existiert und wirklich ein Ordner ist.
    const st = await fs.promises.stat(p);
    return st.isDirectory();
  } catch {
    // Nicht vorhandene oder nicht lesbare Pfade werden wie "kein Ordner" behandelt.
    return false;
  }
}

/* Die Funktion sucht rekursiv nach Git-Repositories unterhalb eines Startordners. */
export async function findGitRepos(rootDir: string): Promise<string[]> {
  const repos: string[] = [];

  async function walk(dir: string): Promise<void> {
    // Ein Ordner mit .git wird als Repository erkannt; tiefer muss dann nicht gesucht werden.
    if (await existsDir(path.join(dir, ".git"))) {
      repos.push(dir);
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      // Grosse bzw. interne Ordner werden ausgelassen, damit die Suche schnell bleibt.
      if (e.name === "node_modules" || e.name === ".git") continue;
      await walk(path.join(dir, e.name));
    }
  }

  await walk(rootDir);
  return repos;
}
/** Anfangsprompt: Wie könnte man eine Textdatei einlesen, in einzelne Zeilen aufteilen, Leerzeichen bereinigen und leere Zeilen entfernen
 */
/** Liest eine Textdatei zeilenweise ein und entfernt Leerzeilen. */
export async function readLines(filePath: string): Promise<string[]> {
  return (
    fs
      // Die Datei wird synchron gelesen; async bleibt die Funktion,
      // damit sie wie andere Datei-Hilfsfunktionen mit await nutzbar ist.
      .readFileSync(filePath, { encoding: "utf8" })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
  );
}

/* Die Funktion trennt ein Datum in deutschen Tages- und Zeit-String auf. */
export function getDayAndTimeFromDate(date: Date): {
  day: string;
  time: string;
} {
  // Formatiert Datum und Uhrzeit im deutschen Format fuer die Ausgabe.
  const day = date.toLocaleDateString("de-DE");
  const time = date.toLocaleTimeString("de-DE", { hour12: false });
  return { day, time };
}

/* Die Funktion entscheidet, ob eine Datei bei der Analyse ignoriert werden soll. */
export function shouldIgnoreFile(file: string): boolean {
  // Konfigurationsdateien werden aus der Code-Analyse herausgefiltert.
  if (file.endsWith(".json")) return true;
  if (file.endsWith(".yml")) return true;

  return false;
}

/* Die Funktion prueft, ob ein Dateipfad zu einer Testdatei gehoert. */
export function isTestFile(file: string): boolean {
  return (
    // Erkennt typische Test-Ordner und Test-Dateiendungen.
    file.includes("/tests/") ||
    file.includes("/test/") ||
    file.includes("/__tests__/") ||
    file.endsWith(".spec.ts") ||
    file.endsWith(".spec.js") ||
    file.endsWith(".test.ts") ||
    file.endsWith(".test.js")
  );
}

/* Die Funktion uebernimmt Autor-Aggregationen aus einer Map in eine andere. */
export function mergeAuthorMaps(
  into: Map<string, AuthorAggregation>,
  from: Map<string, AuthorAggregation>,
) {
  for (const [author, agg] of from.entries()) {
    const prev = into.get(author);
    if (!prev) {
      // Neue Autoren werden als Kopie eingefuegt, damit die Ursprungs-Map
      // nicht versehentlich mitgeaendert wird.
      into.set(author, { ...agg });
      continue;
    }
  }
}

/** Bereitgestellt von Prof. Dr. Jens von Pilgrim. */
const CLONE_DATE_REGEX = /HEAD@\{(\d{2})\.(\d{2})\.(\d{2})\. (\d{2}):(\d{2})\}/;

/* Die Funktion extrahiert aus einem Git-Reflog-Text das Klondatum als Date-Objekt. */
export function extractAndFormatCloneDate(
  reflogOutput: string,
): Date | undefined {
  // Sucht im Reflog nach einem Datum im Format TT.MM.JJ. HH:MM.
  const match = reflogOutput.match(CLONE_DATE_REGEX);
  if (!match) return undefined;

  const [, d, m, y, h, min] = match;

  const date = new Date(
    2000 + Number(y),
    Number(m) - 1,
    Number(d),
    Number(h),
    Number(min),
    0,
  );

  // Ungueltige Datumswerte werden als undefined zurueckgegeben.
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/* Die Funktion liest das Klondatum eines Repositories aus dem Git-Reflog. */
export async function getCloneDate(repoDir: string): Promise<Date | undefined> {
  // Der Git-Reflog enthaelt lokale HEAD-Eintraege; daraus wird das Klondatum gelesen.
  const reflog = await runGit(
    ["reflog", "show", "--date=format:%d.%m.%y. %H:%M"],
    repoDir,
  );

  if (reflog.code !== 0) {
    console.warn(`git reflog failed in ${repoDir}\n${reflog.stderr}`);
  }

  const dateObj = extractAndFormatCloneDate(reflog.stdout);

  if (!dateObj) {
    console.warn(`Kein Klondatum gefunden in ${repoDir}`);
  } else {
    console.log(`Klondatum: ${dateObj}`);
  }

  return dateObj;
}

/* Die Funktion gibt das fruehere Datum aus erstem Commit und optionalem Klondatum zurueck. */
export function earlierDate(firstCommitDate: Date, cloneDate?: Date) {
  // Fuer den Analysebeginn wird das fruehere Datum verwendet:
  // entweder erster Commit oder lokales Klondatum.
  if (!cloneDate) return firstCommitDate;
  if (cloneDate > firstCommitDate) return firstCommitDate;
  else return cloneDate;
}

/* Die Funktion bestimmt den Commit-Typ anhand der Aenderungsanteile eines Commits. */
export function determineCommitTypeFromCommit(
  commit: CommitWithDiff,
): CommitType {
  // Ohne Aenderungen kann kein Schwerpunkt erkannt werden.
  if (commit.totalChanges === 0) {
    return CommitType.MIXED;
  }

  // Die absoluten Aenderungen werden in Prozentanteile umgerechnet.
  const sourcePercent = (commit.totalSourceChanges / commit.totalChanges) * 100;
  const testPercent = (commit.totalTestChanges / commit.totalChanges) * 100;
  const commentPercent =
    (commit.totalCommentChanges / commit.totalChanges) * 100;

  // Die Regeln definieren Prozentbereiche fuer Source-, Test-, Kommentar-
  // und Mixed-Commits. Die erste passende Regel bestimmt den Typ.
  const commitTypes: CommitType[] = [
    CommitType.SOURCE,
    CommitType.TEST,
    CommitType.COMMENT,
    CommitType.MIXED,
  ];
  for (const type of commitTypes) {
    const rule = COMMIT_TYPE_RULES[type];
    if (
      sourcePercent >= rule.sourceMin &&
      sourcePercent <= rule.sourceMax &&
      testPercent >= rule.testMin &&
      testPercent <= rule.testMax &&
      commentPercent >= rule.commentMin &&
      commentPercent <= rule.commentMax
    ) {
      return type;
    }
  }

  return CommitType.MIXED;
}

/* Die Funktion bestimmt den Commit-Typ anhand bereits aggregierter Aenderungszahlen. */
export function determineCommitTypeFromChanges(
  totalChanges: number,
  totalSourceChanges: number,
  totalTestChanges: number,
  totalCommentChanges: number,
): CommitType {
  // Gleiche Logik wie oben, aber fuer bereits aggregierte Zahlenwerte.
  if (totalChanges === 0) {
    return CommitType.MIXED;
  }
  const sourcePercent = (totalSourceChanges / totalChanges) * 100;
  const testPercent = (totalTestChanges / totalChanges) * 100;
  const commentPercent = (totalCommentChanges / totalChanges) * 100;
  const commitTypes: CommitType[] = [
    CommitType.SOURCE,
    CommitType.TEST,
    CommitType.COMMENT,
    CommitType.MIXED,
  ];
  for (const type of commitTypes) {
    const rule = COMMIT_TYPE_RULES[type];
    if (
      sourcePercent >= rule.sourceMin &&
      sourcePercent <= rule.sourceMax &&
      testPercent >= rule.testMin &&
      testPercent <= rule.testMax &&
      commentPercent >= rule.commentMin &&
      commentPercent <= rule.commentMax
    ) {
      return type;
    }
  }
  return CommitType.MIXED;
}

/* Die Funktion berechnet einen Prozentanteil mit zwei Nachkommastellen. */
export function calculatePercent(total: number, part: number) {
  // Gibt den Anteil mit zwei Nachkommastellen als String zurueck.
  return ((part / total) * 100).toFixed(2);
}

/* Die Funktion schreibt Tabellenzeilen als CSV-Datei. */
export function exportCsv(tableRows: Record<string, any>[], filename: string) {
  if (tableRows.length === 0) return;

  /* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/join
  */
  // Die Spaltennamen werden aus der ersten Tabellenzeile erzeugt.
  const header = Object.keys(tableRows[0]).join(",");

  const lines = tableRows.map((row) =>
    Object.values(row)
      /* https://stackoverflow.com/questions/769621/dealing-with-commas-in-a-csv-file */
      // Werte werden in Anfuehrungszeichen gesetzt, damit Kommas im Inhalt
      // nicht als neue CSV-Spalten interpretiert werden.
      .map((v) => `"${String(v)}"`)
      .join(","),
  );

  const csv = [header, ...lines].join("\n");
  /* https://nodejs.org/api/fs.html#fswritefilesyncfile-data-options */
  // Schreibt die fertige CSV-Datei mit UTF-8-Kodierung.
  fs.writeFileSync(filename, csv, "utf8");
}

/* Die Funktion berechnet, wie stark Aenderungen in einem groessten Commit gebuendelt sind. */
export function calculateCommitBundling(commits: CommitWithDiff[]) {
  // Bundling beschreibt, wie stark die Aenderungen in einem einzelnen Commit
  // gebuendelt sind: groesster Commit geteilt durch alle Aenderungen.
  const totals = commits.map((c) => c.totalChanges);

  const totalChanges = totals.reduce((a, b) => a + b, 0);
  const maxCommit = Math.max(...totals);

  const bundling = maxCommit / totalChanges;

  return Number((Math.round(bundling * 100) / 100).toFixed(2));
}

/* Die Funktion berechnet den Durchschnitt der Aenderungen pro Stunde ueber Sessions. */
export function calculateAverageChangesPerHourOverSessions(
  sessions: Session[],
  skipFirstCommit: boolean,
) {
  // Optional wird die erste Session uebersprungen, weil sie oft durch den
  // initialen Commit oder das Klondatum verzerrt sein kann.
  let amountOfSessions = 0;
  let changes = 0;
  if (skipFirstCommit) {
    for (let s = 1; s < sessions.length; s++) {
      amountOfSessions += 1;
      changes += sessions[s].changesPerHour;
    }
  } else {
    for (let s = 0; s < sessions.length; s++) {
      amountOfSessions += 1;
      changes += sessions[s].changesPerHour;
    }
  }
  return Math.round(changes / amountOfSessions);
}

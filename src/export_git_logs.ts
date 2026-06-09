import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { countCodeChanges } from "./git_logs";
import { parseNumstat } from "./parsers";
import { existsDir, extractAndFormatCloneDate } from "./utils";

/**https://git-scm.com/docs/git-show */
async function getFileDiff(
  repoDir: string,
  hash: string,
  file: string,
): Promise<string> {
  // Holt den Diff fuer genau eine Datei in genau einem Commit.
  // --unified=0 liefert nur geaenderte Zeilen ohne zusaetzlichen Kontext.
  const res = await runGit(
    ["show", hash, "--unified=0", "--ignore-all-space", "--", file],
    repoDir,
  );
  // Wenn Git den Diff nicht liefern kann, wird die Datei fuer die Analyse leer behandelt.
  if (res.code !== 0) return "";
  return res.stdout;
}

/**Prompt: Wie könnte man in TypeScript einen Git-Befehl aus einem bestimmten Verzeichnis heraus ausführen und das Ergebnis der Ausführung zurückbekommen? */
export function runGit(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    // Startet git direkt im uebergebenen Repository-Ordner.
    const child = spawn("git", args, { cwd, shell: false });

    let stdout = "";
    let stderr = "";

    // stdout und stderr kommen stueckweise an und werden zu Strings zusammengesetzt.
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));

    // Fehler beim Starten des Prozesses werden abgelehnt; ein Git-Fehlercode
    // wird dagegen normal zurueckgegeben und spaeter ausgewertet.
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
  });
}

/**Anfangsprompt: Wie könnte man aus einem Gitordner die Git-Logs extrahieren */
export async function getGitLogs(repoDir: string): Promise<boolean> {
  // Nur echte Git-Repositories werden verarbeitet.
  if (!(await existsDir(path.join(repoDir, ".git")))) {
    console.warn(`Kein .git-Ordner in: ${repoDir}`);
    return false;
  }

  // Setzt lokale Aenderungen zurueck, damit Git-Kommandos auf einem sauberen Stand laufen.
  await runGit(["reset", "--hard"], repoDir);

  // Exportiert die wichtigsten Commit-Metadaten in einem pipe-getrennten Format.
  const log = await runGit(
    ["log", "--pretty=format:%H|%an|%ae|%ai|%s", "--date=iso"],
    repoDir,
  );
  if (log.code !== 0) {
    console.warn(`git log failed in ${repoDir}\n${log.stderr}`);
    return false;
  }

  const commitsPath = path.join(repoDir, "commits.csv");
  // Kopfzeile und Git-Ausgabe werden gemeinsam als commits.csv gespeichert.
  const commitsCsv =
    ["hash|author|email|date|subject", log.stdout.trimEnd()].join("\n") + "\n";
  await fs.writeFile(commitsPath, commitsCsv, { encoding: "utf8" });

  // numstat liefert pro Commit und Datei die Anzahl eingefuegter und geloeschter Zeilen.
  // Mit -p wird zusaetzlich der Patch ausgegeben, damit Kommentare/Code getrennt zaehlbar sind.
  const numstats = await runGit(
    ["log", "--pretty=format:COMMIT:%H", "--numstat", "-p", "--no-color"],
    repoDir,
  );

  if (numstats.code !== 0) {
    console.warn(`git log --numstats failed in ${repoDir}\n${numstats.stderr}`);
    return false;
  }

  // Create a csv file with all sourceInsertions & sourceDeletions
  const statsPath = path.join(repoDir, "commits_with_stats_full.csv");
  // Die vollstaendige Git-Ausgabe wird als Zwischenstand gespeichert.
  await fs.writeFile(statsPath, numstats.stdout, { encoding: "utf8" });

  // Aus der Git-Ausgabe werden Commit-Datei-Paare extrahiert.
  const commitFiles = parseNumstat(numstats.stdout);
  // console.log("commitFiles", commitFiles);
  const rows: string[] = [
    "hash|file|sourceInsertions|sourceDeletions|comments-sourceInsertions|comments-sourceDeletions",
  ];

  for (const { hash, file } of commitFiles) {
    // Fuer jede geaenderte Datei wird der Diff separat geholt und nach Code-
    // und Kommentarzeilen ausgewertet.
    const diff = await getFileDiff(repoDir, hash, file);
    const countedChanges = countCodeChanges(diff);
    rows.push(
      `${hash}|${file}|${countedChanges.sourceInsertions}|${countedChanges.sourceDeletions}|${countedChanges.commentInsertions}|${countedChanges.commentDeletions}`,
    );
  }

  const cleanPath = path.join(repoDir, "commits_with_stats.csv");
  // Die bereinigte CSV enthaelt nur die fuer die spaetere Analyse benoetigten Spalten.
  await fs.writeFile(cleanPath, rows.join("\n"), { encoding: "utf8" });

  console.log(
    `Fertig: commits.csv, commits_with_stats.csv in: ${repoDir} erstellt.`,
  );
  return true;
}

/** ToDo: Show the error if the path is wrong  */
export async function exportGitLogs(repoDirs: string[]) {
  console.log(`Gefundene Repos: ${repoDirs.length}`);

  const results: { repo: string; ok: boolean }[] = [];
  for (const repo of repoDirs) {
    // Repositories werden nacheinander verarbeitet, damit die Konsolenausgabe lesbar bleibt.
    const ok = await getGitLogs(repo);
    results.push({ repo, ok });
  }
  // Am Ende wird zusammengefasst, wie viele Repositories erfolgreich exportiert wurden.
  const okCount = results.filter((r) => r.ok).length;
  console.log(`Done. OK: ${okCount} / ${results.length}`);
}

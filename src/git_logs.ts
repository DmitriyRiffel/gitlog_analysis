/* Die Funktion prueft, ob eine Zeile leer ist oder nur aus Leerzeichen besteht. */
function isWhitespaceOnly(line: string): boolean {
  // Leere oder nur aus Leerzeichen bestehende Zeilen zaehlen nicht als Code.
  return line.trim().length === 0;
}

/* Die Funktion prueft, ob eine Zeile nur aus einem Kommentar besteht. */
function isCommentOnly(line: string): boolean {
  // Erkennt einfache Kommentarzeilen in JavaScript/TypeScript-Diffs.
  const s = line.trimStart();
  return (
    s.startsWith("//") ||
    s.startsWith("/*") ||
    s.startsWith("*") ||
    s.startsWith("*/")
  );
}

/** Anfangsprompt: Wie könnte man aus einer Codezeile Inline-Kommentare entfernen? */
/* Die Funktion entfernt Inline-Kommentare aus einer einzelnen Codezeile. */
function stripInlineComment(line: string): string {
  // Entfernt alles ab //, damit nur der Codeanteil uebrig bleibt.
  return line.replace(/\/\/.*$/, "");
}

/** Anfangsprompt: Wie könnte man Block-Kommentare aus einer einzelnen Codezeile herausfiltern? */
/* Die Funktion entfernt einzeilige Blockkommentare aus einer Codezeile. */
function stripBlockComments(line: string): string {
  // Entfernt kurze Blockkommentare, die komplett in derselben Zeile stehen.
  return line.replace(/\/\*.*?\*\//g, "");
}

/** Anfangsprompt: Wie könnte man eine Codezeile normalisieren, indem Kommentare entfernt und unnötige Leerzeichen vereinheitlicht werden? */
/* Die Funktion normalisiert eine Codezeile, damit sie vergleichbar wird. */
function normalizeCode(line: string): string {
  // Kommentare und uneinheitliche Leerzeichen werden entfernt, damit zwei
  // Zeilen trotz Kommentaraenderung als gleicher Code erkannt werden koennen.
  let s = stripBlockComments(stripInlineComment(line));
  s = s.trim().replace(/\s+/g, " ");
  s = s.replace(/\s+([;:,)\]}])/g, "$1");
  s = s.replace(/([\(\[\{])\s+/g, "$1");

  return s;
}

/** Anfangsprompt: Wie könnte man prüfen, ob eine Codezeile einen Inline-Kommentar enthält? */
/* Die Funktion prueft, ob eine Zeile einen Inline-Kommentar enthaelt. */
function hasInlineLineComment(line: string): boolean {
  // Sucht nach einem //-Kommentar innerhalb der Zeile.
  return /\/\/.*$/.test(line);
}

/* Die Funktion prueft, ob sich zwischen zwei Zeilen nur der Inline-Kommentar geaendert hat. */
function isOnlyInlineCommentChange(
  removedLine: string,
  addedLine: string,
): boolean {
  // Vergleicht entfernte und hinzugefuegte Zeile ohne Kommentare.
  // Wenn der Code gleich bleibt, war nur der Inline-Kommentar anders.
  const oldCode = normalizeCode(removedLine);
  const newCode = normalizeCode(addedLine);

  return oldCode.length > 0 && oldCode === newCode;
}

/* Die Funktion zaehlt Code- und Kommentar-Aenderungen in einem Git-Diff. */
export function countCodeChanges(diffText: string): {
  sourceInsertions: number;
  sourceDeletions: number;
  commentInsertions: number;
  commentDeletions: number;
} {
  // Git-Diff wird zeilenweise ausgewertet. Zeilen mit + sind Einfuegungen,
  // Zeilen mit - sind Loeschungen.
  const lines = diffText.split("\n");

  let sourceInsertions = 0;
  let sourceDeletions = 0;
  let commentInsertions = 0;
  let commentDeletions = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Diff-Header enthalten Dateinamen und duerfen nicht als Code zaehlen.
    if (line.startsWith("---") || line.startsWith("+++")) continue;

    // Spezialfall: Eine entfernte und direkt danach hinzugefuegte Zeile kann
    // dieselbe Codezeile mit nur geaendertem Inline-Kommentar sein.
    if (line.startsWith("-") && lines[i + 1]?.startsWith("+")) {
      const removed = lines[i].slice(1);
      const added = lines[i + 1].slice(1);

      if (isOnlyInlineCommentChange(removed, added)) {
        const removedHas = hasInlineLineComment(removed);
        const addedHas = hasInlineLineComment(added);

        if (!removedHas && addedHas) commentInsertions++;
        else if (removedHas && !addedHas) commentDeletions++;
        else {
          commentDeletions++;
          commentInsertions++;
        }

        i++;
        continue;
      }
    }

    if (line.startsWith("+")) {
      const content = line.slice(1);
      // Reine Kommentarzeilen werden separat als Kommentar-Einfuegung gezaehlt.
      if (isCommentOnly(content)) {
        commentInsertions++;
      }
      // Nur nicht-leere, nicht-kommentierte Zeilen zaehlen als Source-Code.
      if (!isWhitespaceOnly(content) && !isCommentOnly(content)) {
        sourceInsertions++;
      }
    }

    if (line.startsWith("-")) {
      const content = line.slice(1);
      // Reine Kommentarzeilen werden separat als Kommentar-Loeschung gezaehlt.
      if (isCommentOnly(content)) {
        commentDeletions++;
      }
      // Nur nicht-leere, nicht-kommentierte Zeilen zaehlen als geloeschter Source-Code.
      if (!isWhitespaceOnly(content) && !isCommentOnly(content)) {
        sourceDeletions++;
      }
    }
  }

  return {
    sourceInsertions,
    sourceDeletions,
    commentInsertions: commentInsertions,
    commentDeletions: commentDeletions,
  };
}

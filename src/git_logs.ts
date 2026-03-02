function isWhitespaceOnly(line: string): boolean {
  return line.trim().length === 0;
}

function isCommentOnly(line: string): boolean {
  const s = line.trimStart();
  return (
    s.startsWith("//") ||
    s.startsWith("/*") ||
    s.startsWith("*") ||
    s.startsWith("*/")
  );
}

/** Anfangsprompt: Wie könnte man aus einer Codezeile Inline-Kommentare entfernen? */
function stripInlineComment(line: string): string {
  return line.replace(/\/\/.*$/, "");
}

/** Anfangsprompt: Wie könnte man Block-Kommentare aus einer einzelnen Codezeile herausfiltern? */
function stripBlockComments(line: string): string {
  return line.replace(/\/\*.*?\*\//g, "");
}

/** Anfangsprompt: Wie könnte man eine Codezeile normalisieren, indem Kommentare entfernt und unnötige Leerzeichen vereinheitlicht werden? */
function normalizeCode(line: string): string {
  let s = stripBlockComments(stripInlineComment(line));
  s = s.trim().replace(/\s+/g, " ");
  s = s.replace(/\s+([;:,)\]}])/g, "$1");
  s = s.replace(/([\(\[\{])\s+/g, "$1");

  return s;
}

/** Anfangsprompt: Wie könnte man prüfen, ob eine Codezeile einen Inline-Kommentar enthält? */
function hasInlineLineComment(line: string): boolean {
  return /\/\/.*$/.test(line);
}

function isOnlyInlineCommentChange(
  removedLine: string,
  addedLine: string,
): boolean {
  const oldCode = normalizeCode(removedLine);
  const newCode = normalizeCode(addedLine);

  return oldCode.length > 0 && oldCode === newCode;
}

export function countCodeChanges(diffText: string): {
  sourceInsertions: number;
  sourceDeletions: number;
  commentInsertions: number;
  commentDeletions: number;
} {
  const lines = diffText.split("\n");

  let sourceInsertions = 0;
  let sourceDeletions = 0;
  let commentInsertions = 0;
  let commentDeletions = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("---") || line.startsWith("+++")) continue;

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
      if (isCommentOnly(content)) {
        commentInsertions++;
      }
      if (!isWhitespaceOnly(content) && !isCommentOnly(content)) {
        sourceInsertions++;
      }
    }

    if (line.startsWith("-")) {
      const content = line.slice(1);
      if (isCommentOnly(content)) {
        commentDeletions++;
      }
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

export function countAddedLines(diffText: string): number {
  let sourceInsertions = 0;
  for (const line of diffText.split("\n")) {
    if (!line.startsWith("+")) continue;

    // Ignore header
    if (line.startsWith("+++")) continue;

    const content = line.slice(1);

    // Ignore Whitespace-only
    if (isWhitespaceOnly(content)) continue;

    // Ignore Comments
    if (isCommentOnly(content)) continue;

    sourceInsertions++;
  }

  return sourceInsertions;
}

export function countRemovedLines(diffText: string): number {
  let sourceDeletions = 0;

  for (const line of diffText.split("\n")) {
    if (!line.startsWith("-")) continue;

    // Ignore header
    if (line.startsWith("---")) continue;

    const content = line.slice(1);

    // Whitespace-only ignorieren
    if (isWhitespaceOnly(content)) continue;

    // Ignore Comments
    if (isCommentOnly(content)) continue;

    sourceDeletions++;
  }

  return sourceDeletions;
}

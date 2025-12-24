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

export function countAddedLines(diffText: string): number {
  let insertions = 0;
  for (const line of diffText.split("\n")) {
    if (!line.startsWith("+")) continue;

    // Ignore header
    if (line.startsWith("+++")) continue;

    const content = line.slice(1);

    // Ignore Whitespace-only
    if (isWhitespaceOnly(content)) continue;

    // Ignore Comments
    if (isCommentOnly(content)) continue;

    insertions++;
  }

  return insertions;
}

export function countRemovedLines(diffText: string): number {
  let deletions = 0;

  for (const line of diffText.split("\n")) {
    if (!line.startsWith("-")) continue;

    // Ignore header
    if (line.startsWith("---")) continue;

    const content = line.slice(1);

    // Whitespace-only ignorieren
    if (isWhitespaceOnly(content)) continue;

    // Ignore Comments
    if (isCommentOnly(content)) continue;

    deletions++;
  }

  return deletions;
}

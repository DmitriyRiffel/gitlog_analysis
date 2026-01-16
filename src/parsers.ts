export function splitCommitLinePipe(
  line: string
): [string, string, string, string, string] {
  const parts = line.split("|");
  const hash = (parts[0] ?? "").trim();
  const author = (parts[1] ?? "").trim();
  const email = (parts[2] ?? "").trim();
  const date = (parts[3] ?? "").trim();
  const subject = parts.slice(4).join("|").trim();
  return [hash, author, email, date, subject];
}

export function parseFileStatLine(line: string): {
  hash: string;
  file: string;
  sourceInsertions: number;
  sourceDeletions: number;
  commentInsertions: number;
  commentDeletions: number;
} | null {
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

export function parseNumstat(text: string): { hash: string; file: string }[] {
  const commitFiles: { hash: string; file: string }[] = [];
  let currentHash: string | null = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("COMMIT:")) {
      currentHash = line.slice("COMMIT:".length).trim();
      continue;
    }
    if (!line.trim() || !currentHash) continue;

    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const file = parts.slice(2).join("\t").trim();
    if (file) commitFiles.push({ hash: currentHash, file });
  }

  return commitFiles;
}

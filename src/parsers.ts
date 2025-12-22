export type FileStatRow = {
  hash: string;
  file: string;
  insertions: number;
  deletions: number;
};

/**
 * Splits one commit line by "|" into:
 * hash | author | email | date | subject
 *
 * Note: subject might contain "|" itself, so the remaining parts is going to be joined
 */
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

/**
 * Parses a per-file stat line (hash|file|ins|del).
 * Handles "-" / empty as 0 (common for binary files in git numstat output).
 * Returns null if the line is invalid.
 */
export function parseFileStatLine(line: string): FileStatRow | null {
  const parts = line.split("|");
  if (parts.length < 4) return null;

  const hash = parts[0].trim();
  const file = parts[1].trim();

  const insStr = parts[2].trim();
  const delStr = parts[3].trim();

  const insertions = Number(insStr);
  const deletions = Number(delStr);

  if (!/^[0-9a-f]{40}$/i.test(hash)) return null;
  if (!file) return null;
  if (!Number.isFinite(insertions) || !Number.isFinite(deletions)) return null;

  return { hash, file, insertions, deletions };
}

import * as fs from "node:fs";
import { Commit, CommitWithDiff, Stats, ZERO_STATS } from "./types";

function readLines(path: string): string[] {
  return fs
    .readFileSync(path, { encoding: "utf8" })
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

const commitLines = readLines("commits.csv").slice(1);

function splitCommitLinePipe(
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

const commits: Commit[] = commitLines
  .map(splitCommitLinePipe)
  .filter((p) => p[1] !== "Jens von Pilgrim")
  .map((p) => ({
    hash: (p[0] ?? "").trim(),
    author: (p[1] ?? "").trim(),
    email: (p[2] ?? "").trim(),
    date: new Date(p[3]),
    subject: (p[4] ?? "").trim(),
  }))
  .sort((a, b) => a.date.getTime() - b.date.getTime());

type FileStatRow = {
  hash: string;
  file: string;
  insertions: number;
  deletions: number;
};

function parseFileStatLine(line: string): FileStatRow | null {
  const parts = line.split("|");
  if (parts.length < 4) return null;

  const hash = (parts[0] ?? "").trim();
  const file = (parts[1] ?? "").trim();

  const insStr = (parts[2] ?? "").trim();
  const delStr = (parts[3] ?? "").trim();

  const insertions = insStr === "-" || insStr === "" ? 0 : Number(insStr);
  const deletions = delStr === "-" || delStr === "" ? 0 : Number(delStr);

  if (!/^[0-9a-f]{40}$/i.test(hash)) return null;
  if (!file) return null;
  if (!Number.isFinite(insertions) || !Number.isFinite(deletions)) return null;

  return { hash, file, insertions, deletions };
}

const statsLines = readLines("commits_with_stats.csv").slice(1);

const statsByHash = new Map<string, Stats>();
const filesByHash = new Map<string, Set<string>>();

for (const line of statsLines) {
  const row = parseFileStatLine(line);
  if (!row) continue;

  if (!filesByHash.has(row.hash)) filesByHash.set(row.hash, new Set());
  filesByHash.get(row.hash)!.add(row.file);

  const prev = statsByHash.get(row.hash) ?? { ...ZERO_STATS };

  const insertions = prev.insertions + row.insertions;
  const deletions = prev.deletions + row.deletions;

  statsByHash.set(row.hash, {
    filesChanged: 0,
    insertions,
    deletions,
    totalChanges: insertions + deletions,
  });
}

for (const [hash, set] of filesByHash.entries()) {
  const prev = statsByHash.get(hash) ?? { ...ZERO_STATS };
  statsByHash.set(hash, { ...prev, filesChanged: set.size });
}

const commitsWithDiff: CommitWithDiff[] = commits.map((c, i) => {
  const day = c.date.toLocaleDateString("sv-SE");
  const time = c.date.toLocaleTimeString("de-DE", { hour12: false });

  const st = statsByHash.get(c.hash) ?? ZERO_STATS;

  if (i === 0) {
    return {
      ...c,
      day,
      time,
      diffHours: 0,
      diffMinutes: 0,
      ...st,
      changesPerHour: 0,
      changesPerMinute: 0,
    };
  }

  const prev = commits[i - 1];
  const prevDay = prev.date.toLocaleDateString("sv-SE");

  if (day !== prevDay) {
    return {
      ...c,
      day,
      time,
      diffHours: 0,
      diffMinutes: 0,
      ...st,
      changesPerHour: 0,
      changesPerMinute: 0,
    };
  }

  const diffMs = c.date.getTime() - prev.date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffMinutes = diffHours * 60;

  const changesPerHour = diffHours !== 0 ? st.totalChanges / diffHours : 0;
  const changesPerMinute =
    diffMinutes !== 0 ? st.totalChanges / diffMinutes : 0;

  return {
    ...c,
    day,
    time,
    diffHours,
    diffMinutes,
    ...st,
    changesPerHour,
    changesPerMinute,
  };
});

console.table(
  commitsWithDiff.map((c) => ({
    hash: c.hash,
    author: c.author,
    subject: c.subject,
    day: c.day,
    time: c.time,
    files: c.filesChanged,
    ins: c.insertions,
    del: c.deletions,
    total: c.totalChanges,
    diff_h: Number(c.diffHours.toFixed(3)),
    diff_m: Number(c.diffMinutes.toFixed(3)),
    chg_h: Number(c.changesPerHour.toFixed(2)),
  }))
);

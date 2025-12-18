export type Stats = {
  filesChanged: number;
  insertions: number;
  deletions: number;
  totalChanges: number;
};

export const ZERO_STATS: Stats = {
  filesChanged: 0,
  insertions: 0,
  deletions: 0,
  totalChanges: 0,
};

export type Commit = {
  hash: string;
  author: string;
  email: string;
  date: Date;
  subject: string;
};

export type CommitWithDiff = Commit &
  Stats & {
    day: string;
    time: string;
    diffHours: number;
    diffMinutes: number;
    changesPerHour: number;
    changesPerMinute: number;
  };

export type RunResult = { stdout: string; stderr: string; code: number };

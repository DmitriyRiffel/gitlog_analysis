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

export type AuthorAggregation = {
  author: string;
  commitCount: number;

  firstCommitAt: Date;
  firstCommitHash: string;

  lastCommitAt: Date;

  totalInsertions: number;
  totalDeletions: number;
  totalChanges: number;
};

export type CriteriaRow = {
  author: string;
  tooLittleCommits: "ja" | "nein";
  firstCommitDay: string;
  firstCommitTime: string;
  firstCommitHash?: string;
  lastCommitDay?: string;
  commitCount: number;
  totalChanges: number;
  firstCommitAtDeadline: "ja" | "nein";
};

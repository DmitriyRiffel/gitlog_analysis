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
  };

export type AuthorAggregation = {
  author: string;
  commitCount: number;

  firstCommitDate: Date;
  firstCommitHash: string;

  lastCommitDate: Date;

  totalInsertions: number;
  totalDeletions: number;
  totalChanges: number;

  sessions: Session[];
};

export type CriteriaRow = {
  author: string;
  areFewCommits: boolean;
  areFewChanges: boolean;
  firstCommitDate: Date;
  lastCommitDate: Date;
  commitCount: number;
  totalChanges: number;
  totalSessions: number;
  averageChangesPerHour: number;
  averageCommitsPerSession: number;
  firstCommitOnDeadline: boolean;
};

export type Session = Stats & {
  author: string;
  sessionIndex: number;
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  commitCount: number;
  changesPerHour?: number;
};

export type CliInput = {
  repoPath: string;
  deadline: Date;
  estimatedEffort: number;
  commitThresholdMultiplier: number;
  changesThresholdMultiplier: number;
};

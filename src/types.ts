export type Stats = {
  filesChanged: number;
  insertions: number;
  commentInsertions: number;
  deletions: number;
  commentDeletions: number;
  totalChanges: number;
  totalCommentChanges: number;
  insertionsInTests: number;
  deletionsInTests: number;
  totalChangesInTests: number;
};

export const ZERO_STATS: Stats = {
  filesChanged: 0,
  insertions: 0,
  deletions: 0,
  totalChanges: 0,
  commentInsertions: 0,
  commentDeletions: 0,
  totalCommentChanges: 0,
  insertionsInTests: 0,
  deletionsInTests: 0,
  totalChangesInTests: 0,
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
  totalCommentInsertions: number;
  totalCommentDeletions: number;
  totalInsertionsInTests: number;
  totalDeletionsInTests: number;
  totalChanges: number;
  totalCommentChanges: number;
  totalChangesInTests: number;
  sessions: Session[];
};

export type CriteriaRow = {
  author: string;
  areFewCommits: boolean;
  areFewChanges: boolean;
  areFewChangesInTests: boolean;
  firstCommitDate: Date;
  lastCommitDate: Date;
  commitCount: number;
  totalChanges: number;
  totalCommentChanges: number;
  totalChangesInTests: number;
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

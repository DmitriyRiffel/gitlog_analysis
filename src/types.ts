export type Stats = {
  filesChanged: number;
  sourceInsertions: number;
  commentInsertions: number;
  sourceDeletions: number;
  commentDeletions: number;
  totalSourceChanges: number;
  totalCommentChanges: number;
  testInsertions: number;
  testDeletions: number;
  totalTestChanges: number;
  totalChanges: number;
};

export const ZERO_STATS: Stats = {
  filesChanged: 0,
  sourceInsertions: 0,
  sourceDeletions: 0,
  totalSourceChanges: 0,
  commentInsertions: 0,
  commentDeletions: 0,
  totalCommentChanges: 0,
  testInsertions: 0,
  testDeletions: 0,
  totalTestChanges: 0,
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

  repo: string;

  firstCommitHash: string;
  firstCommitDate: Date;
  cloneDate?: Date;

  lastCommitDate: Date;

  totalSourceInsertions: number;
  totalSourceDeletions: number;
  totalCommentInsertions: number;
  totalCommentDeletions: number;
  totalTestInsertions: number;
  totalTestDeletions: number;
  totalSourceChanges: number;
  totalCommentChanges: number;
  totalTestChanges: number;
  totalChanges: number;
  sessions: Session[];
};

export type CriteriaRow = {
  author: string;
  areFewCommits: boolean;
  areFewChanges: boolean;
  areFewChangesInTests: boolean;
  startDate: Date;
  endDate: Date;
  commitCount: number;
  totalSourceChanges: number;
  totalCommentChanges: number;
  totalTestChanges: number;
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

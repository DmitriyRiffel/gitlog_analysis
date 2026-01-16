export enum CommitType {
  SOURCE,
  TEST,
  COMMENT,
  MIXED,
}

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
  commitType: CommitType;
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
  commitType: CommitType.MIXED,
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
  totalCommentCommits: number;
  totalSourceCommits: number;
  totalTestCommits: number;
  totalMixedCommits: number;
  totalCommits: number;
  sessions: Session[];
};

export type CriteriaRow = {
  author: string;
  areFewCommits: boolean;
  areFewChanges: boolean;
  areFewChangesInTests: boolean;
  startDate: Date;
  endDate: Date;
  totalSourceChanges: number;
  totalCommentChanges: number;
  totalTestChanges: number;
  totalChanges: number;
  totalSessions: number;
  totalCommentCommits: number;
  totalSourceCommits: number;
  totalTestCommits: number;
  totalMixedCommits: number;
  totalCommits: number;
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

export type CommitTypeRule = {
  sourceMin: number;
  sourceMax: number;
  testMin: number;
  testMax: number;
  commentMin: number;
  commentMax: number;
};

export const COMMIT_TYPE_RULES: Record<CommitType, CommitTypeRule> = {
  [CommitType.SOURCE]: {
    sourceMin: 80,
    sourceMax: 100,
    testMin: 0,
    testMax: 20,
    commentMin: 0,
    commentMax: 20,
  },
  [CommitType.TEST]: {
    sourceMin: 0,
    sourceMax: 20,
    testMin: 80,
    testMax: 100,
    commentMin: 0,
    commentMax: 20,
  },
  [CommitType.COMMENT]: {
    sourceMin: 0,
    sourceMax: 20,
    testMin: 0,
    testMax: 20,
    commentMin: 80,
    commentMax: 100,
  },
  [CommitType.MIXED]: {
    sourceMin: 50,
    sourceMax: 60,
    testMin: 40,
    testMax: 50,
    commentMin: 0,
    commentMax: 10,
  },
};

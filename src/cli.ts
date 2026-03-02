import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { CliInput } from "./types";

export async function askCliInput(repoName: string): Promise<CliInput> {
  const rl = readline.createInterface({ input, output });

  /** Only for Development */
  // For windows:
  const DEFAULT_REPO: string = `F:/Hochschule/BA/${repoName}`;

  // For mac:
  // const DEFAULT_REPO: string = `/Volumes/ExterneSSD/Bachelor/${repoName}`;

  let DEFAULT_DEADLINE: string;
  switch (DEFAULT_REPO) {
    case "F:/Hochschule/BA/sample1":
      DEFAULT_DEADLINE = "2024-04-28";
      break;
    case "F:/Hochschule/BA/sample2":
      DEFAULT_DEADLINE = "2023-06-04";
      break;
    case "F:/Hochschule/BA/sample3":
      DEFAULT_DEADLINE = "2024-06-02";
      break;
    case "F:/Hochschule/BA/sample4":
      DEFAULT_DEADLINE = "2025-05-11";
      break;
    case "F:/Hochschule/BA/sample5":
      DEFAULT_DEADLINE = "2025-06-08";
      break;
    case "/Volumes/ExterneSSD/Bachelor/sample1":
      DEFAULT_DEADLINE = "2024-04-28";
      break;
    case "/Volumes/ExterneSSD/Bachelor/sample2":
      DEFAULT_DEADLINE = "2023-06-04";
      break;
    case "/Volumes/ExterneSSD/Bachelor/sample3":
      DEFAULT_DEADLINE = "2024-06-02";
      break;
    case "/Volumes/ExterneSSD/Bachelor/sample4":
      DEFAULT_DEADLINE = "2025-05-11";
      break;
    case "/Volumes/ExterneSSD/Bachelor/sample5":
      DEFAULT_DEADLINE = "2025-06-08";
      break;
    default:
      DEFAULT_DEADLINE = "1000-01-01";
  }
  /** ------ */

  const DEFAULT_CHANGES_THRESHOLD_MULT = 1.5;
  const DEFAULT_ESTIMATED_EFFORT = 6;
  const DEFAULT_COMMIT_THRESHOLD = 6;
  try {
    const repoPath =
      (await rl.question(`Pfad zum Ordner mit Repos: `)).trim() || DEFAULT_REPO;
    const skipFirstCommitAnswer = (
      await rl.question("Ersten Commit überspringen? (y/n, Default=y): ")
    )
      .trim()
      .toLowerCase();

    const deadlineStr =
      (await rl.question(`Deadline (YYYY-MM-DD): `)).trim() || DEFAULT_DEADLINE;

    const commitThresholdStr =
      (
        await rl.question(
          `Untere Grenze der Commitsanzahl (Default = ${DEFAULT_COMMIT_THRESHOLD}): `,
        )
      ).trim() || DEFAULT_COMMIT_THRESHOLD;

    const changesThresholdMultiplierStr =
      (
        await rl.question(
          `Multiplikator für Untere Grenze der Änderungen im Bereich 1-3 (Default = ${DEFAULT_CHANGES_THRESHOLD_MULT}): `,
        )
      ).trim() || DEFAULT_CHANGES_THRESHOLD_MULT;
    const estimatedEffortStr =
      (
        await rl.question(
          `Geschätzte Aufwand in Stunden (Default = ${DEFAULT_ESTIMATED_EFFORT} St.): `,
        )
      ).trim() || DEFAULT_ESTIMATED_EFFORT;
    const skipFirstCommit =
      skipFirstCommitAnswer === ""
        ? true
        : skipFirstCommitAnswer === "y" ||
          skipFirstCommitAnswer === "yes" ||
          skipFirstCommitAnswer === "true";
    return {
      repoPath,
      skipFirstCommit: skipFirstCommit,
      deadline: new Date(`${deadlineStr}T23:59:59`),
      estimatedEffort: Number(estimatedEffortStr),
      commitThreshold: Number(commitThresholdStr),
      changesThresholdMultiplier: Number(changesThresholdMultiplierStr),
    };
  } finally {
    rl.close();
  }
}

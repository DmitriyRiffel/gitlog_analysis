import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import {
  countAddedLines,
  countCodeChanges,
  countRemovedLines,
} from "./git_logs";
import { parseNumstat } from "./parsers";
import { existsDir, findGitRepos } from "./utils";

async function getFileDiff(
  repoDir: string,
  hash: string,
  file: string
): Promise<string> {
  const res = await runGit(
    ["show", hash, "--unified=0", "--ignore-all-space", "--", file],
    repoDir
  );
  if (res.code !== 0) return "";
  return res.stdout;
}

function runGit(
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, shell: false });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
  });
}

export async function getGitLogs(repoDir: string): Promise<boolean> {
  if (!(await existsDir(path.join(repoDir, ".git")))) {
    console.warn(`Kein .git-Ordner in: ${repoDir}`);
    return false;
  }

  console.log(`Erzeuge Git-Logs in: ${repoDir}`);

  const log = await runGit(
    ["log", "--pretty=format:%H|%an|%ae|%ai|%s", "--date=iso"],
    repoDir
  );
  if (log.code !== 0) {
    console.warn(`git log failed in ${repoDir}\n${log.stderr}`);
    return false;
  }

  const commitsPath = path.join(repoDir, "commits.csv");
  const commitsCsv =
    ["hash|author|email|date|subject", log.stdout.trimEnd()].join("\n") + "\n";
  await fs.writeFile(commitsPath, commitsCsv, { encoding: "utf8" });

  const numstats = await runGit(
    [
      "log",
      "--pretty=format:COMMIT:%H",
      "--numstat",
      "-p",
      "--unified=0",
      "--no-color",
    ],
    repoDir
  );

  if (numstats.code !== 0) {
    console.warn(`git log --numstats failed in ${repoDir}\n${numstats.stderr}`);
    return false;
  }

  // Create a csv file with all insertions & deletions
  const statsPath = path.join(repoDir, "commits_with_stats_full.csv");
  await fs.writeFile(statsPath, numstats.stdout, { encoding: "utf8" });

  const commitFiles = parseNumstat(numstats.stdout);
  // console.log("commitFiles", commitFiles);
  const rows: string[] = [
    "hash|file|insertions|deletions|comments-insertions|comments-deletions",
  ];

  for (const { hash, file } of commitFiles) {
    const diff = await getFileDiff(repoDir, hash, file);
    rows.push(
      `${hash}|${file}|${countCodeChanges(diff).insertions}|${
        countCodeChanges(diff).deletions
      }|${countCodeChanges(diff).commentInsertions}|${
        countCodeChanges(diff).commentDeletions
      }`
    );
  }

  const cleanPath = path.join(repoDir, "commits_with_stats.csv");
  await fs.writeFile(cleanPath, rows.join("\n") + "\n", { encoding: "utf8" });

  console.log("Fertig: commits.csv, commits_with_stats.csv erstellt.");
  return true;
}

/** ToDo: Show the error if the path is wrong  */
export async function exportGitLogs(repoDirs: string[]) {
  console.log(`Gefundene Repos: ${repoDirs.length}`);

  const results: { repo: string; ok: boolean }[] = [];
  for (const repo of repoDirs) {
    const ok = await getGitLogs(repo);
    results.push({ repo, ok });
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`Done. OK: ${okCount} / ${results.length}`);
}

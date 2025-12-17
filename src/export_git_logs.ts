import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { RunResult } from "./types";

type Pair = { hash: string; file: string; deletions: number };

function parseNumstat(text: string): Pair[] {
  const pairs: Pair[] = [];
  let currentHash: string | null = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("COMMIT:")) {
      currentHash = line.slice("COMMIT:".length).trim();
      continue;
    }
    if (!line.trim() || !currentHash) continue;

    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const delStr = parts[1];
    const file = parts.slice(2).join("\t").trim();
    const deletions = delStr === "-" ? 0 : Number(delStr);
    if (file) pairs.push({ hash: currentHash, file, deletions });
  }

  return pairs;
}

function countAddedLines(diffText: string): number {
  let insertions = 0;
  for (const line of diffText.split("\n")) {
    if (!line.startsWith("+")) continue;

    if (line.startsWith("+++")) continue;

    const content = line.slice(1);

    if (content.trim().length === 0) continue;

    insertions++;
  }

  return insertions;
}

async function getFileDiff(
  repoDir: string,
  hash: string,
  file: string
): Promise<string> {
  const res = await runGit(["show", hash, "--unified=0", "--", file], repoDir);
  if (res.code !== 0) return "";
  return res.stdout;
}

function runGit(args: string[], cwd: string): Promise<RunResult> {
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

async function existsDir(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function findGitRepos(rootDir: string): Promise<string[]> {
  const repos: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (await existsDir(path.join(dir, ".git"))) {
      repos.push(dir);
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const e of entries) {
      if (!e.isDirectory()) continue;

      if (e.name === "node_modules" || e.name === ".git") continue;

      await walk(path.join(dir, e.name));
    }
  }

  await walk(rootDir);
  return repos;
}

async function getGitLogs(repoDir: string): Promise<boolean> {
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
    ["log", "--pretty=format:COMMIT:%H", "--numstat"],
    repoDir
  );
  if (numstats.code !== 0) {
    console.warn(`git log --numstats failed in ${repoDir}\n${numstats.stderr}`);
    return false;
  }

  // Create a csv file with all insertions & deletions
  const statsPath = path.join(repoDir, "commits_with_stats_full.csv");
  await fs.writeFile(statsPath, numstats.stdout, { encoding: "utf8" });

  const pairs = parseNumstat(numstats.stdout);

  const rows: string[] = ["hash|file|insertions|deletions"];

  for (const { hash, file, deletions } of pairs) {
    const diff = await getFileDiff(repoDir, hash, file);
    rows.push(`${hash}|${file}|${countAddedLines(diff)}|${deletions}`);
  }

  const cleanPath = path.join(repoDir, "commits_with_stats.csv");
  await fs.writeFile(cleanPath, rows.join("\n") + "\n", { encoding: "utf8" });

  console.log("Fertig: commits.csv, commits_with_stats.csv erstellt.");
  return true;
}

async function main() {
  const rootDir = "F:/Hochschule/BA/sample1";

  const repoDirs = await findGitRepos(rootDir);
  console.log(`Gefundene Repos: ${repoDirs.length}`);

  const results: { repo: string; ok: boolean }[] = [];
  for (const repo of repoDirs) {
    const ok = await getGitLogs(repo);
    results.push({ repo, ok });
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`Done. OK: ${okCount}/${results.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

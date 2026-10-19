const { createHash } = require("node:crypto");
const { readFileSync, appendFileSync } = require("node:fs");
const path = require("node:path").posix;

const adoptionDate = "2026-10-19T00:00:00Z";
const reservedNames = new Set([
  "agents.md",
  "claude.md",
  "agents.override.md",
  "claude.local.md",
]);
const linkSha = createHash("sha1").update("blob 9\0AGENTS.md").digest("hex");

function instructionScope(filename) {
  const parent = path.dirname(filename);
  return path.basename(parent) === ".claude" ? path.dirname(parent) : parent;
}

function instructionScopes(entries) {
  return new Set(
    entries
      .filter((entry) =>
        reservedNames.has(path.basename(entry.path).toLowerCase())
      )
      .map((entry) => instructionScope(entry.path))
  );
}

function validateTree(entries, previousEntries = [], requireRoot = true) {
  const errors = [];
  const files = new Map(entries.map((entry) => [entry.path, entry]));
  const scopes = instructionScopes(entries);
  if (requireRoot) {
    scopes.add(".");
  }
  for (const scope of instructionScopes(previousEntries)) {
    if (
      scope === "." ||
      entries.some((entry) => entry.path.startsWith(`${scope}/`))
    ) {
      scopes.add(scope);
    }
  }
  for (const entry of entries) {
    const filename = path.basename(entry.path);
    if (!reservedNames.has(filename.toLowerCase())) {
      continue;
    }
    if (!["AGENTS.md", "CLAUDE.md"].includes(filename)) {
      errors.push(
        `${entry.path}: use AGENTS.md or CLAUDE.md with this exact case.`
      );
    }
    if (
      entry.path
        .split("/")
        .slice(0, -1)
        .some((part) => part.toLowerCase() === ".claude" && part !== ".claude")
    ) {
      errors.push(`${entry.path}: use the exact directory name .claude.`);
    }
    if (
      path.basename(path.dirname(entry.path)) === ".claude" &&
      (filename !== "CLAUDE.md" || !["100644", "100755"].includes(entry.mode))
    ) {
      errors.push(
        `${entry.path}: .claude permits only a regular CLAUDE.md instruction file.`
      );
    }
  }
  for (const scope of [...scopes].sort()) {
    const agents = path.join(scope, "AGENTS.md");
    const claude = path.join(scope, "CLAUDE.md");
    if (!["100644", "100755"].includes(files.get(agents)?.mode)) {
      errors.push(
        `${agents}: require a regular shared instruction file. Empty content is valid.`
      );
    }
    const partner = files.get(claude);
    if (partner?.mode !== "120000" || partner.sha !== linkSha) {
      errors.push(
        `${claude}: require a Git symlink with target exactly AGENTS.md.`
      );
    }
  }
  return errors;
}

async function readTree(request, revision) {
  const result = await request(`/git/trees/${revision}?recursive=1`);
  if (!result.truncated) {
    return result.tree;
  }
  const entries = [];
  const pending = [{ sha: revision, prefix: "" }];
  while (pending.length) {
    const { sha, prefix } = pending.shift();
    const tree = await request(`/git/trees/${sha}`);
    if (tree.truncated) {
      throw new Error(
        `Cannot inspect the complete Git tree at ${prefix || "/"}.`
      );
    }
    for (const entry of tree.tree) {
      const filename = prefix + entry.path;
      entries.push({ ...entry, path: filename });
      if (entry.type === "tree") {
        pending.push({ sha: entry.sha, prefix: `${filename}/` });
      }
    }
  }
  return entries;
}

async function validateRepository(request, event) {
  const base = event.pull_request?.base.sha ?? event.merge_group?.base_sha;
  const head = event.pull_request?.head.sha ?? event.merge_group?.head_sha;
  if (!base || !head) {
    throw new Error(
      "This action requires a pull_request or merge_group event."
    );
  }
  const [repository, previousEntries, entries] = await Promise.all([
    request(""),
    readTree(request, base),
    readTree(request, head),
  ]);
  if (repository.fork || repository.archived) {
    return [];
  }
  const requireRoot =
    repository.is_template || repository.created_at >= adoptionDate;
  return validateTree(entries, previousEntries, requireRoot);
}

async function run() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.INPUT_TOKEN;
  if (!repository || !token) {
    throw new Error("The repository and a read token are required.");
  }
  const request = async (endpoint) => {
    const response = await fetch(
      `https://api.github.com/repos/${repository}${endpoint}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(30000),
      }
    );
    if (!response.ok) {
      throw new Error(
        `GitHub returned ${response.status} for ${endpoint || "/"}.`
      );
    }
    return response.json();
  };
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const errors = await validateRepository(request, event);
  if (errors.length) {
    for (const error of errors) {
      console.error(JSON.stringify(error));
    }
    throw new Error(
      "Agent instruction files do not satisfy the shared convention."
    );
  }
  const message =
    "Agent instruction scopes satisfy the sibling symlink convention.";
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, message + "\n");
  }
}

module.exports = { validateTree, readTree, validateRepository, linkSha };

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

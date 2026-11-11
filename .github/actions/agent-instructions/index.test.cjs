const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  validateTree,
  readTree,
  validateRepository,
  linkSha,
} = require("./index.cjs");

function pair(prefix = "") {
  return [
    {
      path: prefix + "AGENTS.md",
      mode: "100644",
      type: "blob",
      sha: "empty-or-shared-content",
    },
    { path: prefix + "CLAUDE.md", mode: "120000", type: "blob", sha: linkSha },
  ];
}

test("accepts root, nested, hidden, and optional Claude-specific instructions", () => {
  assert.deepEqual(
    validateTree([
      ...pair(),
      ...pair("src/"),
      ...pair("docs/.mintlify/"),
      { path: ".claude/CLAUDE.md", mode: "100644", type: "blob" },
      { path: "src/.claude/CLAUDE.md", mode: "100644", type: "blob" },
      { path: "other/code.ts", mode: "100644", type: "blob" },
    ]),
    []
  );
});

for (const prefix of ["", "src/", "docs/.mintlify/"]) {
  test(`rejects a missing sibling at ${prefix || "the root"}`, () => {
    const entries = pair(prefix).slice(0, 1);
    assert.ok(
      validateTree(entries).some((error) =>
        error.startsWith(prefix + "CLAUDE.md:")
      )
    );
  });
}

for (const filename of [
  "agents.md",
  "CLAUDE.local.md",
  "AGENTS.override.md",
  ".Claude/CLAUDE.md",
]) {
  test(`rejects alternate instruction path ${filename}`, () => {
    assert.ok(
      validateTree([...pair(), { path: filename, mode: "100644" }]).length
    );
  });
}

test("rejects regular copies, imports, reversed links, and other link targets", () => {
  for (const mode of ["100644", "100755", "120000"]) {
    assert.ok(
      validateTree([
        pair()[0],
        { path: "CLAUDE.md", mode, sha: "different-content-or-link" },
      ]).length
    );
  }
  assert.ok(
    validateTree([
      { path: "AGENTS.md", mode: "120000", sha: "CLAUDE.md" },
      { path: "CLAUDE.md", mode: "100644" },
    ]).length
  );
});

test("rejects removal of a covered pair while its directory remains", () => {
  const previous = [...pair(), ...pair("src/")];
  assert.ok(
    validateTree([...pair(), { path: "src/code.ts", mode: "100644" }], previous)
      .length
  );
  assert.ok(
    validateTree([{ path: "README.md", mode: "100644" }], pair(), false).length
  );
});

test("accepts deletion of an entire covered subdirectory", () => {
  assert.deepEqual(validateTree(pair(), [...pair(), ...pair("src/")]), []);
});

test("permits old repositories with neither file until migration", () => {
  assert.deepEqual(
    validateTree([{ path: "code.ts", mode: "100644" }], [], false),
    []
  );
  assert.ok(validateTree([], [], true).length);
});

test("reads every subtree after a truncated recursive response without entering submodules", async () => {
  const responses = {
    "/git/trees/head?recursive=1": { truncated: true, tree: [] },
    "/git/trees/head": {
      tree: [
        { path: "src", type: "tree", sha: "child" },
        { path: "vendor", type: "commit", sha: "submodule" },
      ],
    },
    "/git/trees/child": { tree: pair() },
  };
  const entries = await readTree(async (endpoint) => {
    assert.ok(endpoint in responses);
    return responses[endpoint];
  }, "head");
  assert.deepEqual(
    entries.filter((entry) => entry.type === "blob"),
    pair("src/")
  );
});

test("fails closed when even a nonrecursive tree response is truncated", async () => {
  await assert.rejects(
    readTree(async () => ({ truncated: true, tree: [] }), "head"),
    /complete Git tree/
  );
});

for (const event of [
  { pull_request: { base: { sha: "base" }, head: { sha: "head" } } },
  { merge_group: { base_sha: "base", head_sha: "head" } },
]) {
  test("enforces the root on new repositories for PR and merge queue events", async () => {
    const errors = await validateRepository(async (endpoint) => {
      if (!endpoint) {
        return { created_at: "2026-10-20T00:00:00Z" };
      }
      return { tree: [] };
    }, event);
    assert.equal(errors.length, 2);
  });
}

test("enforces the root on older templates and preserves migrated scopes on older repositories", async () => {
  for (const repository of [
    { created_at: "2020-01-01T00:00:00Z", is_template: true },
    { created_at: "2020-01-01T00:00:00Z", is_template: false },
  ]) {
    const errors = await validateRepository(
      async (endpoint) => {
        if (!endpoint) {
          return repository;
        }
        return { tree: endpoint.includes("base") ? pair() : [] };
      },
      { merge_group: { base_sha: "base", head_sha: "head" } }
    );
    assert.equal(errors.length, 2);
  }
});

test("fails closed on missing event revisions and GitHub API failures", async () => {
  await assert.rejects(
    validateRepository(async () => ({}), {}),
    /requires a pull_request/
  );
  await assert.rejects(
    validateRepository(
      async () => {
        throw new Error("API unavailable");
      },
      { merge_group: { base_sha: "base", head_sha: "head" } }
    ),
    /API unavailable/
  );
});

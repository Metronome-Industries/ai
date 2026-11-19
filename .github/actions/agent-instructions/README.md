# Shared agent instructions

Each instruction scope uses this structure:

```text
AGENTS.md                 Regular shared instructions. Empty content is valid.
CLAUDE.md -> AGENTS.md     Relative sibling symlink, recorded with Git mode 120000.
.claude/CLAUDE.md          Optional regular file for Claude-specific instructions.
```

The same rule applies to subfolders, including hidden folders.
Folders without separate instructions need no file pair.
Each symlink points to the `AGENTS.md` beside it.
Human review decides which instructions are specific to Claude.
The CI check enforces the file structure.

The action reads the base and proposed Git trees through the GitHub API.
It does not check out the target repository, install dependencies, or run target code.
It reads no instruction content because the Git blob hash identifies the required link target.
The action supports pull requests and merge queues.
Truncated tree responses trigger a complete subtree traversal.
Submodules require enforcement in their own repositories.

New repositories created from October 19, 2026, and repository templates require the root pair.
Older repositories with neither file remain valid until migration.
Once a scope exists, later changes cannot remove its pair while that directory still contains tracked files.
Deletion of the complete subdirectory is valid.
Incorrect filename case, regular Claude copies, alternate link targets, and tracked local override files fail.

GitHub templates can seed the pair, but developers must select a template during repository creation.
The organization policy service opens draft repair PRs for new repositories and templates that miss the pair.
The service waits for the first default-branch commit.
This process does not guarantee the pair in the first commit of every repository.

The organization ruleset starts in evaluation mode.
After migration, an organization owner activates it to block invalid merges.
Evaluation mode records results without blocking merges.
Generated SDK repositories use central exclusions.

Run the action tests with:

```bash
node --test .github/actions/agent-instructions/index.test.cjs
```

The required workflow pins the action to a reviewed commit.
If the action changes, update that pin in `.github/workflows/agent-instructions.yml`.

GitHub documentation:

- [Repository templates](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository)
- [Required workflows in rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-workflows-to-pass-before-merging)

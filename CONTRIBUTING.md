# Contributing

Contributions are welcome, but **not to `skills/`** in this repository.

## Skills are generated

Everything under `skills/` is synced from `docs/skills/` in the private `Metronome-Industries/api` repository, where the skills live alongside the documentation they encode. A GitHub Action mirrors that directory here on every merge. Editing `skills/` here has no lasting effect: the next sync wipes and rewrites the directory, so the change is silently reverted.

A workflow leaves an automated review on any pull request that touches `skills/`, so you will get told rather than discovering it weeks later.

### Proposing a skill change

**If you work at Metronome:** open a pull request against `docs/skills/` in the `api` repo, targeting `main`. Run `npm run lint:skills` before pushing; it runs in CI. The contract for skill layout, frontmatter, and reference links is in `docs/.mintlify/AGENTS.md` there.

**If you do not:** open an issue describing the change — what is wrong or missing, and ideally the wording you would use. A maintainer will port it upstream. Please do not open a pull request editing `skills/`; it cannot be merged.

## What you can change here

`README.md`, `CONTRIBUTING.md`, `skills/README.md`, and anything under `.github/` are maintained in this repository. Fork, branch, and open a pull request as usual.

## Contributor License Agreement ([CLA](https://en.wikipedia.org/wiki/Contributor_License_Agreement))

Once you have submitted a pull request, sign the CLA by clicking the badge in the comment from [@CLAassistant](https://github.com/CLAassistant).

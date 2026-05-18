# Contributing

Contributions are welcome. To make changes:

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository and [clone](https://help.github.com/articles/cloning-a-repository/) it locally.
2. Make your changes.
3. Submit a [pull request](https://help.github.com/articles/creating-a-pull-request-from-a-fork/).

## Adding a new skill

1. Create a directory under `skills/` with your skill name (e.g., `skills/my-skill/`).
2. Add a `SKILL.md` file with YAML frontmatter (`name`, `description`) and markdown body.
3. Optionally add a `references/` subdirectory with supporting markdown files.
4. Reference files from SKILL.md using `<references/filename.md>` syntax.

## Skill format

```yaml
---
name: my-skill
description: >-
  One-paragraph description of when this skill should be used.
---

[Markdown body with guidance, tables, code examples, and links]
```

## Contributor License Agreement ([CLA](https://en.wikipedia.org/wiki/Contributor_License_Agreement))

Once you have submitted a pull request, sign the CLA by clicking on the badge in the comment from [@CLAassistant](https://github.com/CLAassistant).

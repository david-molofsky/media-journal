# Contributing to Media Journal

## Branches

Create a focused branch from the latest `main`. Use a short descriptive name, for example:

```text
codex/trust-documentation-and-versioning
```

## Commits

Write an imperative summary that identifies the outcome. Prefer:

```text
Align displayed version with package metadata
Document connected services in privacy policy
Remove unused root-level source copies
```

Avoid generic messages such as `Add files via upload`, `Update files` or `Changes` because they make regressions and release history difficult to trace.

Keep unrelated changes in separate commits when practical. If a group of files delivers one coherent story, a single story-level commit is appropriate.

## Pull requests

Every pull request should explain:

- what changed;
- why it changed;
- how it was verified;
- any user-data, migration, privacy or rollback considerations.

Before requesting review, run:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
```

Use a descriptive pull-request title that can also serve as the squash-merge commit message.

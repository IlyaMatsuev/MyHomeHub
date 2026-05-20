---
description: Write/adjust unit tests for my recent code changes following the Tester workflow
---

I've just updated some code. Write unit tests for the new code, or adjust the existing tests if needed.

Rules:

- Do NOT change my newly written (non-test) code. Only add or modify test files. If something requires changes to write proper unit tests, ask about it first.
- Validate my changes first: read the diff, confirm the code is correct, and flag anything that looks wrong before writing tests.
- Follow the Tester workflow defined in `.claude/agents/tester.md` (Jest, `*.spec.ts` co-located with source, NestJS testing patterns, mocking conventions, teardown of timers/handles).
- Match the existing test style and structure in the affected spec files.
- When the implementation moved/renamed things, move/rename the corresponding tests the same way rather than duplicating.
- Run the affected suites (and then the full suite) to confirm everything is green before reporting.

Scope: $ARGUMENTS

If no scope is given above, default to the changes in the last commit plus any uncommitted working-tree changes (`git show HEAD` and `git diff`).

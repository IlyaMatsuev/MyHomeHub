# MyHomeHub Development Agents

This directory contains prompt configurations for AI agents that assist with development tasks.

## Agents Overview

| Agent           | File             | Purpose                                             |
| --------------- | ---------------- | --------------------------------------------------- |
| **Architect**   | `architect.md`   | Plans feature implementations, designs architecture |
| **Implementer** | `implementer.md` | Writes code following Architect's plans             |
| **Reviewer**    | `reviewer.md`    | Reviews code for quality and standards              |
| **Tester**      | `tester.md`      | Writes unit and integration tests                   |

## Workflow

```
Feature Request
      │
      ▼
┌─────────────┐
│ Architect   │  ← Creates implementation plan
└──────┬──────┘
       │ Plan
       ▼
┌──────────────┐
│ Implementer  │  ← Writes the code
└──────┬───────┘
       │ Code
       ▼
┌──────────┐
│ Reviewer │  ← Checks quality & standards
└────┬─────┘
     │ Approved
     ▼
┌────────┐
│ Tester │  ← Writes tests
└────────┘
```

## Usage

### With Claude Code

Reference an agent's prompt when starting a task:

```
Use the Architect agent to plan: "Add support for Zigbee devices"
```

```
Use the Implementer agent to implement task 3 from the plan
```

```
Use the Reviewer agent to review the changes in src/devices-control/
```

### Agent Handoffs

Each agent produces artifacts the next agent consumes:

1. **Architect → Implementer**
    - Implementation plan with tasks
    - Interface definitions
    - File paths and structure

2. **Implementer → Reviewer**
    - Source code files
    - Module changes

3. **Reviewer → Implementer** (if issues found)
    - Review comments
    - Required fixes

4. **Implementer → Tester**
    - Completed source code
    - Service/controller files to test

## Quick Reference

### Architect Outputs

- Implementation plan markdown
- Task breakdown with dependencies
- Interface definitions
- API design

### Implementer Outputs

- TypeScript source files
- DTOs, services, controllers
- Schema definitions
- Module registrations

### Reviewer Outputs

- Review summary (Approve/Request Changes)
- Issue list with fixes
- Code suggestions

### Tester Outputs

- `*.spec.ts` test files
- Mock factories
- Integration tests

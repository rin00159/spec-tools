# spec-tools

CLI toolkit for spec-driven project management and AI collaboration.

Derived from [k4t4-framework](https://github.com/k4t4-framework) — works as a standalone tool.

## Overview

`spec-tools` provides a set of commands to keep your spec clauses, implementation, and project documentation in sync. It is designed to work alongside AI coding assistants by making project state machine-verifiable rather than relying on prose-based conventions.

## Installation

```sh
npm install -g spec-tools
# or
npx spec-tools <command>
```

## Configuration

Create a `spec-tools.config.json` file at the root of your repository to customize behavior:

```json
{
  "specRoots": ["spec", "packages/*/docs/spec"],
  "checkCurrentTask": {
    "file": "docs/currentTask.ai.md",
    "maxLines": 80,
    "headings": ["## Current Task", "## Context", "## Next Steps"]
  },
  "specCoverage": {
    "conformanceRoots": ["spec"],
    "scanRoots": ["packages", "examples"],
    "sourceExtensions": [".ts", ".tsx"],
    "testSuffixes": [".test.ts"]
  },
  "docRef": {
    "decisionDir": "docs/decisions",
    "taskDir": "docs/task"
  },
  "scaffold": {
    "startNumber": 200
  }
}
```

All fields are optional. Omit any section to use defaults.

## Commands

Below are a few key commands. For the full reference, see [docs/instruction/commands.md](./docs/instruction/commands.md).

### `spec-tools spec-coverage`

Answers three questions about your spec's implementation status:

1. **Tests without a clause ID** — should be 0.
2. **Clauses with no implementation** — normative, active clauses whose `impl` version has been reached but have no test or registered error code — should be 0.
3. **References to non-existent clause IDs** — should be 0.

```sh
spec-tools spec-coverage [--phase <override>]
```

### `spec-tools spec-show <clause-id>`

Prints the full text of a single spec clause by its ID, without loading the entire spec file.

```sh
spec-tools spec-show K-CORE-ERR-001
```

### `spec-tools scaffold <decision|task|acceptance|phase>`

Scaffolds a new numbered document from a template. Numbers are assigned as `max(existing) + 1` to prevent hand-counting mistakes.

```sh
spec-tools scaffold decision "Add retry logic"
spec-tools scaffold decision --package @scope/my-lib "Lib-level contract"
```

## Traceability Model

`spec-tools` tracks implementation coverage through two sources only:

- **(a) Test names** — a test whose name starts with a clause ID counts as evidence that the clause is implemented.
- **(b) Registered error codes** — an error code that is registered in the spec's error code table and carries a clause ID counts as evidence.

No custom static analysis is needed. The convention is: if a clause is implemented, there must be a test that says so in its name.
# Internal Structure of the `spec-tools` Repository

This document outlines the directory structure and design assumptions for the development of `spec-tools` itself.

## Directory Structure

```text
spec-tools/
 ├── src/
 │    ├── cli.ts                # Entry point. Handles argument parsing and command dispatching.
 │    ├── config.ts             # Loads user configuration (spec-tools.config.json) and defines default values.
 │    └── commands/             # Implementation directories for each command
 │         ├── spec-coverage/   # Implementation of `spec-coverage`
 │         ├── spec-index/      # Implementation of `spec-index`
 │         ├── doc-ref/         # Implementation of `doc-ref` (list, show, index, check)
 │         ├── scaffold/        # Implementation of `scaffold` (decision, task, acceptance, phase)
 │         ├── check-mirror.ts  # Implementation of `check-mirror`
 │         ├── check-plan-layout.ts # Plan layout structural check
 │         └── check-current-task.ts# Task format structural check
 │
 ├── templates/                 # Default Markdown templates for `scaffold`
 │    ├── decision.md
 │    ├── task.md
 │    └── acceptance.md
 │
 ├── fixtures/                  # Dummy repositories and files for testing
 │
 ├── docs/                      # Documentation for the tool itself (this directory)
 │
 ├── package.json
 ├── tsconfig.json
 ├── tsdown.config.ts           # tsdown build configuration (generates dist/)
 └── biome.json                 # Linter / Formatter configuration
```

## Design Assumptions and Constraints

1. **Separation of Pure Functions**: 
   Complex parsing and aggregation logic (e.g., `extractClauseBody` in `clause.ts` or path resolution in `specRoots.ts`) are designed as side-effect-free pure functions to remain easily testable.
2. **Minimizing External Dependencies**:
   Due to the nature of the tool—which scans target repositories that may not necessarily be Node.js projects—it does not enforce npm-specific constraints (such as requiring a `package.json`). Instead, it relies on pure file system operations (like `fs/promises`) for resolution.
3. **English Error Messages**:
   Assuming usage as a generic tool across various projects, output messages in `throw new Error` or `console.*` are written in English. (Specific terminology intended only for internal projects should not be included).

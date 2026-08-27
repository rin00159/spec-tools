# spec-tools

`spec-tools` is a CLI toolset for managing specifications (spec), architecture decision records (decisions), and tasks (task) written in Markdown, and verifying their coverage and referential integrity against the implementation.

## Key Features

- **Specification Coverage Check (`spec-coverage`)**: 
  Scans source code, comments, and test files for clause IDs (e.g., `K-CORE-001`) to verify links between specs and implementations, ensuring no missing coverage.
- **Referential Integrity Check (`doc-ref`)**: 
  Checks and resolves cross-package references (e.g., `root:200` or `045`) for decisions and tasks to ensure they are not broken, and automatically generates an index (`INDEX.md`).
- **Scaffolding (`scaffold`)**: 
  Automatically assigns numbers and generates new Markdown files for decisions, tasks, and acceptances while preventing duplicate numbering.
- **Mirror Check (`check-mirror`)**: 
  Verifies that files are synchronized between specified directories (e.g., `.claude/` and `.agents/`).

## Documentation

- [Assumed File Structure and Concepts (assumed-structure.md)](./assumed-structure.md)
- [Command Reference (commands.md)](./commands.md)
- [Configuration (configuration.md)](./configuration.md)
- [Internal Structure of spec-tools (internal-structure.md)](./internal-structure.md)

# Assumed File Structure and Concepts

`spec-tools` assumes that the target repository organizes its documents according to a specific directory structure and concepts (or default conventions).

## 1. Concept: Target Point (ImplPoint) and Phase

This tool manages the progress of a project using a Target Point (ImplPoint) expressed as **Major.Minor.Phase** (e.g., `v0_1_16`).

- It assumes that the current execution code Phase is recorded as a single string in the **`spec/PHASE`** file at the repository root (e.g., `v0_1_16`).
- If the Phase specified in a clause's `impl` attribute is less than or equal to the current Phase, the clause is considered "implemented (testable)" and becomes a target for coverage.

## 2. Assumed File and Directory Structure

While some paths can be changed in the configuration (`spec-tools.config.json`), the standard structure assumed is as follows.
In a monorepo setup, you can place package-specific documents under `packages/*` in addition to the root directory.

```text
<repo_root>/
 ├── spec/
 │    ├── PHASE               # Current progress point (e.g., v0_1_16)
 │    ├── INDEX.md            # Auto-generated clause index by `spec-index`
 │    └── *.md                # Markdown specification documents defining clauses
 │
 ├── docs/
 │    ├── decisions/          # Architecture Decision Records (ADR)
 │    │    ├── INDEX.md       # Auto-generated index
 │    │    └── <NNN>-*.md     # Documents created by `scaffold decision` (NNN is sequential)
 │    │
 │    ├── task/               # Task records
 │    │    ├── INDEX.md       # Auto-generated index
 │    │    ├── README.md      # Manual tracking for task execution order and decisions
 │    │    └── <NNN>-*.md     # Documents created by `scaffold task`
 │    │
 │    ├── plan/
 │    │    └── <major>_<minor>/
 │    │         └── phase<N>.md   # Plan document for each phase
 │    │
 │    └── acceptance/
 │         └── phase-v<major>_<minor>-<N>.md # Acceptance records created by `scaffold acceptance`
 │
 ├── packages/
 │    └── <package_name>/
 │         └── docs/
 │              ├── spec/       # Package-specific specifications
 │              ├── decisions/  # Package-specific decisions
 │              └── task/       # Package-specific tasks
 │
 └── templates/                 # Template files referenced during scaffolding
      ├── decision.md
      ├── task.md
      └── acceptance.md
```

## 3. Clause Writing Rules

In specification documents (`spec/**/*.md`), clauses are defined using headings and attributes as shown below:

```markdown
## K-CORE-DEF-001 Monotonic Refinement

**Attributes**: `status: active`, `since: 0.1.0`, `kind: Normative`, `impl: v0_1_1`

(The content from here to the next `## ` is treated as the body of the clause)
```

- **Heading**: An ID matching the regular expression (default: `(K-[A-Z0-9]+(?:-[A-Z0-9]+)*)`) is required.
- **Attribute Line**: A line containing attributes like `status`, `since`, `kind`, `impl`, etc., must immediately follow.
  - `status`: By default, `active` is considered valid.
  - `kind`: By default, `Normative` is treated as a mandatory requirement.

# Proposed File Structures and Concepts (Not Handled by the Library)

## 1. Proposed File and Directory Structure
<repo_root>/
 ├── packages/          # For temporary files, used to prevent mixing with the repository's regular files
 └── docs/
      ├── instruction/   # Instruction manuals
      ├── guide/         # Quick guides for users
      ├── source/        # Reference materials that do not fit elsewhere
      └── discussions/   # Discussion records not included in decisions

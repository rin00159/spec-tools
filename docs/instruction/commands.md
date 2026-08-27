# Command Reference

This tool functions as a CLI (`node dist/cli.mjs <command>` or `pnpm spec-tools <command>`).

## `spec-coverage`
Verifies the alignment between implementations (source code, test files) and specification clauses (Clauses).
Checks whether "Normative" clauses expected to be implemented by the current Phase have corresponding tests, and ensures there are no references to unknown clauses.

```bash
spec-tools spec-coverage [--phase <override_phase>]
```

## `spec-index`
Scans specification documents under directories like `spec/` to generate `spec/INDEX.md`.

```bash
spec-tools spec-index [--check]
```
If `--check` is specified, it runs in verify-only mode without writing to the file, failing if the current `INDEX.md` is out of date (useful for CI).

## `doc-ref index <decision|task>`
Scans files in `docs/decisions/` or `docs/task/` and generates an `INDEX.md` at the root and in each package.

```bash
spec-tools doc-ref index decision [--check]
spec-tools doc-ref index task [--check]
```
The `--check` flag works the same way as it does in `spec-index`.

## `doc-ref check`
Verifies that references to decisions or tasks (e.g., `045` or `@scope/pkg:102`) found across the entire project repository point to existing documents.

```bash
spec-tools doc-ref check
```

## `doc-ref list <decision|task>`
Outputs a cross-package list of decisions or tasks across the dependency closure.

```bash
spec-tools doc-ref list decision [--package <name>]
```

## `doc-ref show <decision|task>`
Looks up and prints a document to the console based on the provided number or namespaced reference.

```bash
spec-tools doc-ref show decision 105
spec-tools doc-ref show task @scope/pkg:200
```

## `scaffold <decision|task|acceptance|phase>`
Generates templates for new documents.

- **`scaffold decision <slug> [title]`**: Creates a new Architecture Decision Record.
- **`scaffold task <slug> [title]`**: Creates a new task document.
- **`scaffold acceptance`**: Creates a new Acceptance Record based on the current Phase.
- **`scaffold phase <v_major_minor_phase>`**: Updates the content of the `spec/PHASE` file.

```bash
spec-tools scaffold decision [--package <name>] my-new-feature "About the new feature"
```
* By specifying `--package`, documents can be created within a specific package.

## `check-mirror`
Verifies that files under two specified directories are kept identical (mirrored state).

```bash
spec-tools check-mirror
```

## `check-plan-layout` / `check-current-task`
Verifies layout constraints of plan documents and the formatting of task files.

# spec-tools Conventions

## Spec Scan Roots

### Roots are discovered via glob (required)

The scan roots for clause discovery are **the root `spec/` directory and `packages/*/docs/spec/`**.
`spec:index`, `spec:show`, and `spec:coverage` **must discover these roots via glob (required)**.
**Hard-coding individual package names on the checking side is forbidden** — if package additions or removals require a corresponding change on the checking side, missed updates become **silent coverage gaps** (same reasoning as the verification model).

### Fail when a scan yields zero results (required)

- **When zero roots are discovered, the tool must not succeed (forbidden).**
- **When a scan yields zero clauses, the tool must not succeed (forbidden).**

Zero results mean "not measured", not "zero violations".
A checker that reports "0 unimplemented clauses" while having read no clauses at all is worse than no check — **a broken check stays green and silently misses the drift it is supposed to detect**.

Partial failures — where only some roots are missed by the glob — are not caught by these two rules alone.
The permanent ratchet for that is the **`spec/INDEX.md` freshness check** (`check:spec-index`):
if any root drops out, the index diverges from the current state and `pnpm lint` fails.
**Continuously checking the index as a generated artifact is the mechanism for detecting a shrinking scan scope.**

### Detect duplicate clause IDs across roots (required)

If the same clause ID appears as a heading in more than one location, that is an error (required).
**This applies across roots as well.**
The normative rule itself (no gaps, no reuse, no renumbering) lives in `packages/core/docs/spec/00-conventions.md` under "Clause ID format" —
**this section defines only the obligation to detect duplicates mechanically**; it does not duplicate the rule.
**Distributing storage is not the same as distributing the numbering scheme.**

> **Scope note**: This duplicate-detection rule applies **only to the scan roots of this repository (`spec/` and `packages/*/docs/spec/`)**.
> It is unrelated to the kata framework (external repositories that use kata2, or the conceptual meaning of kata as a framework).
> "Clause IDs must be unique across the repository" is a mechanical constraint of this repository's checking infrastructure, not an obligation imposed externally by the kata framework spec.

### CODEs must be unique across all scan roots (required)

The uniqueness of CODE defined in `packages/core/docs/spec/00-conventions.md` ("Clause ID format") covers **the scope of a library and its dependents**.
**Here, in addition to that, all packages present in the scan roots must have non-colliding CODEs (required).**

The reason is the same as for duplicate clause ID detection: **the index is a single unified index over all roots** (see next section).
If CODEs collide, it becomes impossible to uniquely identify the owning package from a clause ID,
and `pnpm lint` (`check:reference-direction`) can no longer determine **the direction of clause references** (a package must not claim clause IDs belonging to its dependents).

> **Scope note**: This is a mechanical constraint of bundling all scan roots into a single index in this repository, not an obligation imposed externally by the kata framework spec (same as the previous section's note).

### The index covers all roots as one (required)

`spec/INDEX.md` is **a single index covering clauses from all scan roots combined (required)**.
Splitting the index per package is forbidden — doing so forces users of `pnpm spec:show` to first decide "which index to look at", which defeats the purpose of the index: **reach any clause in one hop from its ID** (see `docs/decisions/089`).


## Traceability — Conventions for Detecting "Implementation Corresponds to a Clause"

`spec:coverage` performs no custom static analysis. There are exactly **two** detection sources:

- **(a) A clause ID at the start of a test name**
- **(b) An error code that is registered in the error code registry** (`packages/core/docs/spec/00-conventions.md`, K-CORE-ERR-002) and carries a clause ID

In other words, "has an implementation" means: a test or a registered error code that references the clause exists.

### The three questions `spec:coverage` answers

1. **Tests without a clause ID** — enumeration of tests whose names do not start with a clause ID (0 is normal).
2. **Clauses with no implementation or test** — enumeration of such clauses (0 is normal). The scope is limited to **`kind: normative` and `status: active` clauses whose `impl` version/phase has been reached**.
   Reachedness is determined by a three-integer lexicographic comparison of `impl` against the current version and phase (required).
   Without this, a future-phase clause written in phase 0 would appear to contradict a phase 1 completion check.
3. **Tests or error messages referencing non-existent clause IDs** — enumeration of such references (0 is normal).

### Where the current position (reached version/phase) lives

The "current position" required by question 2 **must be stored in `spec/PHASE` (required)**. The format is the same single token as `impl`: `v<major>_<minor>_<phase>`.

**The current position must be written in exactly one place (required).** Duplicating it into tool invocation configuration (e.g. a `package.json` script) is **forbidden** — duplication causes CI and acceptance checks to read different values, making **CI use a weaker comparison** (this actually occurred in v0.1 phases 4, 8, and 9; `docs/acceptance/phase-8.md` records the duplicate as a pitfall to avoid).

A mechanism for temporarily overriding the current position (e.g. a `--phase` argument) is permitted (optional).
If such a mechanism exists, **providing the override more than once must be an error (required)**.
Silently taking the first or last value is forbidden — the user cannot know their input was ignored (C3).

### Clauses beyond the current position must be reported (required)

Clauses whose `impl` is ahead of the current position are excluded from question 2. This is intentional, but it is **indistinguishable from a forgotten position update**.
Therefore, `spec:coverage` **must always output the count of `status: active` clauses with `impl` ahead of the current position, along with the maximum such `impl` value**.

**This must not be treated as a failure (required).** Writing future-phase clauses in advance is the entire purpose of `impl` (without it, a clause written in phase 0 would contradict a phase 1 completion check).
What is forbidden is **staying silent about it**, not writing clauses ahead of time.

### The scope in which a leading clause ID is required

Regarding the rule that test names must begin with a clause ID (the rule itself lives in `packages/core/docs/spec/00-conventions.md` under "Test name conventions"):
question 1 applies this rule to **tests under `packages/` and `examples/`**.
These are the code (and reference applications) that implement clauses, and the goal of question 1 is to ensure **no tests have slipped in without a corresponding clause**.

**Tests under `tools/` are excluded from question 1 (optional).** `tools/` contains development tooling, not clause implementations, and there are no clauses to correspond to. Forcing an existing clause ID to the front of a tools test name would create **a false implementation trace** for that clause (since detection source (a) counts any leading ID as evidence).
A false trace is worse than no check — it silently hides drift that should be detected.

**Question 3 (references to non-existent clause IDs) does apply to `tools/` (required).**
There is no reason to exempt any location from the rule that a clause ID written anywhere must actually exist.

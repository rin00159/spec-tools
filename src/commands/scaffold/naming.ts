// Numbering and file naming rules (pure functions).

import type { ImplPoint } from '../spec-coverage/implPoint.ts';

const NUMBERED_FILE_RE = /^(\d{3})-[a-z0-9_-]+\.md$/;
export const SLUG_RE = /^[a-z0-9_]+(?:-[a-z0-9_]+)*$/;

/**
 * Returns the existing **maximum number +1** (minimum 200). We do not use file count +1 (duplicates if there are missing numbers.
 * There is a record of number duplication in v1). Used in both `docs/decisions/` and `docs/task/`.
 * native starts numbering from 200, and freezes legacy (001~110 / 001~063) (docs/decisions/109 decision 4-c).
 */
export function nextNumber(fileNames: readonly string[], startNumber: number = 200): number {
	let max = 0;
	for (const name of fileNames) {
		const match = name.match(NUMBERED_FILE_RE);
		if (!match?.[1]) {
			continue;
		}
		max = Math.max(max, Number(match[1]));
	}
	return Math.max(startNumber - 1, max) + 1;
}

export function numberedFileName(numberValue: number, slug: string): string {
	return `${String(numberValue).padStart(3, '0')}-${slug}.md`;
}

export interface ScaffoldPathsConfig {
	planDirTemplate?: string;
	planFileTemplate?: string;
	acceptanceFileTemplate?: string;
}

/** Version directory (`docs/plan/0_2`). `impl`'s major/minor is exactly the version. */
export function planDirFor(point: ImplPoint, config?: ScaffoldPathsConfig): string {
	const template = config?.planDirTemplate ?? 'docs/plan/{{major}}_{{minor}}';
	return template
		.replace(/\{\{major\}\}/g, String(point.major))
		.replace(/\{\{minor\}\}/g, String(point.minor))
		.replace(/\{\{phase\}\}/g, String(point.phase));
}

/** The source of truth for the plan of that Phase (`docs/plan/0_2/phase24.md`). */
export function planFileFor(point: ImplPoint, config?: ScaffoldPathsConfig): string {
	const template = config?.planFileTemplate ?? '{{planDir}}/phase{{phase}}.md';
	const planDir = planDirFor(point, config);
	return template
		.replace(/\{\{planDir\}\}/g, planDir)
		.replace(/\{\{major\}\}/g, String(point.major))
		.replace(/\{\{minor\}\}/g, String(point.minor))
		.replace(/\{\{phase\}\}/g, String(point.phase));
}

/** Acceptance evidence (`docs/acceptance/phase-v0_2-24.md`). */
export function acceptanceFileFor(point: ImplPoint, config?: ScaffoldPathsConfig): string {
	const template =
		config?.acceptanceFileTemplate ?? 'docs/acceptance/phase-v{{major}}_{{minor}}-{{phase}}.md';
	return template
		.replace(/\{\{major\}\}/g, String(point.major))
		.replace(/\{\{minor\}\}/g, String(point.minor))
		.replace(/\{\{phase\}\}/g, String(point.phase));
}

export function decisionTemplate(numberValue: number, title: string, today: string): string {
	return `# ${String(numberValue).padStart(3, '0')} ${title}

**Date**: ${today}
**Status**: Confirmed
**Context**: 

---

## Background

Which bug, request, or clause did it start from?

## Decision

What was decided? **The clause is the source of truth**, so write "why this clause was chosen" here.

## Unselected options and reasons

The part where you will be asked later "why is it not like this?".

## Related clause IDs

List of new, changed, or withdrawn clauses (write "None" if none).

## Other defects found during implementation

Write it even if it's not the main subject. If a ticket was created, add the number in \`docs/task/\`.
`;
}

export function acceptanceTemplate(
	point: ImplPoint,
	today: string,
	config?: ScaffoldPathsConfig,
): string {
	const label = `v${point.major}.${point.minor} Phase ${point.phase}`;
	return `# ${label} Acceptance Evidence

**Date & Time**: ${today}
**Source of Truth**: \`${planFileFor(point, config)}\`
**Decision**: 

---

## Verification of Completion Criteria

| # | Completion Criteria | Result | Evidence / Notes |
|---|---|---|---|
| 1 |  |  |  |

## Quality Gate

\`\`\`
pnpm verify --gate
\`\`\`

(Paste a summary of the output. **Do not use "Deployed" as measured evidence**)

## Not implemented (intentional)

Things sent to the subsequent Phase. **Things sent without being put on a Phase should be ticketed in \`docs/task/\`**.

---

- [ ] User approval
`;
}

export function taskTemplate(numberValue: number, title: string, today: string): string {
	return `# ${String(numberValue).padStart(3, '0')} ${title}

**Created**: ${today}
**Relations**: 

## What is the problem?

## What to do (proposal)

## Prerequisites / Blockers

If the Phase you can start depends on another task, write it. If none, write "None".
`;
}

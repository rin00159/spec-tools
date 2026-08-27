// List of decisions / task. Scans the dependency closure and groups them by the location of the entity.
// The primary source is docs/decisions/109 Decision 4 and Decision 8 / docs/plan/0_3/done/phase8.md R3.
//
//   pnpm task:list
//   pnpm task:list --package @scope/core
//
// The list (index) is held by docs/task/INDEX.md on the entity side (tools/doc-ref/src/indexGen.ts).
// This is an output to view across the dependency closure.
// The only thing left in docs/task/README.md is the "which to do first" table (Decision 8).

import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { discoverPackages, type PackageEntry } from './closure.ts';
import type { DocType } from './show.ts';

// There is a legacy file containing `_` in the file name (036-v0_2-after-tasks.md).
const NUMBERED_FILE_RE = /^(\d{3})-[a-z0-9_-]+\.md$/;

export interface DocEntry {
	readonly owner: string;
	readonly reference: string;
	readonly number: string;
	readonly title: string;
	readonly state: string;
	readonly filePath: string;
	readonly isStub: boolean;
}

function firstTitle(content: string): string {
	const line = content.split('\n', 1)[0] ?? '';
	return line
		.replace(/^#+\s*/, '')
		.replace(/^\d{3}\s+/, '')
		.trim();
}

function firstState(content: string, statePattern?: RegExp): string {
	const re = statePattern ?? /^\*\*State\*\*:\s*(.+)$/m;
	const m = content.match(re);
	if (!m?.[1]) {
		return '—';
	}
	// Drop bold and links, and collapse into a single line
	return m[1].replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Starting from repoRoot, scans docs/<subDir>/ of the root and all packages in the dependency closure.
 * Root stubs (pointing to moved locations) are collapsed into the entity side and not shown in the list.
 */
export function collectDocs(
	repoRoot: string,
	docType: DocType,
	packages: ReadonlyArray<PackageEntry>,
	decisionDir: string = 'docs/decisions',
	taskDir: string = 'docs/task',
	startNumber: number = 200,
	statePatternStr?: string,
	stubPatternStr?: string,
): DocEntry[] {
	const subDir = docType === 'decision' ? decisionDir : taskDir;
	const entries: DocEntry[] = [];
	// discoverPackages collapses with realpath, so the root determination is also aligned with realpath (/var -> /private/var on macOS).
	const realRoot = realpathSync(repoRoot);

	const stateRe = statePatternStr ? new RegExp(statePatternStr, 'm') : undefined;
	const stubRe = stubPatternStr
		? new RegExp(stubPatternStr)
		: /\*\*Moved To\*\*:\s*`([^`]+)`/;

	for (const pkg of packages) {
		const dir = join(pkg.dir, subDir);
		let names: string[];
		try {
			names = readdirSync(dir);
		} catch {
			continue;
		}
		const isRoot = pkg.dir === realRoot;
		for (const name of names.sort()) {
			const m = NUMBERED_FILE_RE.exec(name);
			if (!m?.[1]) {
				continue;
			}
			const num = m[1];
			const filePath = join(dir, name);
			const content = readFileSync(filePath, 'utf8');
			const isStub = stubRe.test(content);
			if (isStub) {
				// The entity is picked up on the moved package side
				continue;
			}
			const bare = isRoot && Number(num) < startNumber;
			entries.push({
				owner: pkg.name,
				reference: bare ? num : `${pkg.name}:${num}`,
				number: num,
				title: firstTitle(content),
				state: firstState(content, stateRe),
				filePath,
				isStub,
			});
		}
	}

	return entries;
}

function render(
	repoRoot: string,
	docType: DocType,
	entries: readonly DocEntry[],
	taskDir: string = 'docs/task',
): string {
	const byOwner = new Map<string, DocEntry[]>();
	for (const e of entries) {
		const list = byOwner.get(e.owner) ?? [];
		list.push(e);
		byOwner.set(e.owner, list);
	}

	const owners = [...byOwner.keys()].sort((a, b) => {
		// scope (root) at the top, then by name
		if (a.includes('/') !== b.includes('/')) {
			return a.includes('/') ? 1 : -1;
		}
		return a.localeCompare(b);
	});

	const lines: string[] = [
		`# ${docType} list (Closure scan, grouped by location, ${entries.length} items total)`,
		'',
	];
	for (const owner of owners) {
		const list = (byOwner.get(owner) ?? []).sort((a, b) => a.number.localeCompare(b.number));
		lines.push(`## ${owner} (${list.length} items)`);
		const width = Math.max(...list.map((e) => e.reference.length));
		for (const e of list) {
			lines.push(`  ${e.reference.padEnd(width)}  ${e.title}`);
			lines.push(`  ${' '.repeat(width)}  State: ${e.state}`);
			lines.push(`  ${' '.repeat(width)}  ${relative(repoRoot, e.filePath)}`);
		}
		lines.push('');
	}
	lines.push(
		`Read the content via \`pnpm ${docType}:show <reference>\`.`,
		docType === 'task' ? `Task priority/order is managed in ${taskDir}/README.md.` : '',
	);
	return lines.filter((l) => l !== undefined).join('\n');
}

export async function runList(
	repoRoot: string,
	docType: string | undefined,
	filter: string | undefined,
): Promise<void> {
	if (docType !== 'decision' && docType !== 'task') {
		console.error('Usage: spec-tools doc-ref list <decision|task> [--package <name>]');
		process.exitCode = 2;
		return;
	}

	const packages = await discoverPackages(repoRoot);
	const target = filter ? packages.filter((p) => p.name === filter) : packages;
	if (filter && target.length === 0) {
		console.error(`Package not found: ${filter}`);
		process.exitCode = 1;
		return;
	}

	const fullConfig = (await import('../../config.ts')).loadConfig(repoRoot);
	const decisionDir = fullConfig.docRef?.decisionDir ?? 'docs/decisions';
	const taskDir = fullConfig.docRef?.taskDir ?? 'docs/task';

	const entries = collectDocs(
		repoRoot,
		docType,
		target,
		decisionDir,
		taskDir,
		fullConfig.scaffold?.startNumber,
		fullConfig.docRef?.statePattern,
		fullConfig.docRef?.stubPattern,
	);
	console.log(render(repoRoot, docType, entries, taskDir));
}

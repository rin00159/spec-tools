// Reference resolution and display of decisions / task.
// The primary source is docs/decisions/109 Decision 4 and Decision 8 / docs/plan/0_3/phase5.md Scope 6.
//
//   pnpm decision:show 105
//   pnpm decision:show @scope/target-firebase_cloudflare-html:105
//   pnpm decision:show scope:200
//   pnpm task:show 061
//   pnpm task:show @scope/targetlib-schemaui:200

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { discoverPackages, type PackageEntry } from './closure.ts';

export type DocType = 'decision' | 'task';

export interface ResolvedDoc {
	readonly reference: string;
	readonly filePath: string;
	readonly content: string;
}

// There is a legacy file containing `_` in the file name (036-v0_2-after-tasks.md).
const NUMBERED_FILE_RE = /^(\d{3})-[a-z0-9_-]+\.md$/;

async function findNumberedFile(dir: string, targetNum: number): Promise<string | undefined> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		const prefix = `${String(targetNum).padStart(3, '0')}-`;
		for (const entry of entries) {
			if (entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.md')) {
				return join(dir, entry.name);
			}
		}
	} catch {
		// E.g. when directory does not exist
	}
	return undefined;
}

async function listNumberedFiles(dir: string): Promise<string[]> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		return entries.filter((e) => e.isFile() && NUMBERED_FILE_RE.test(e.name)).map((e) => e.name);
	} catch {
		return [];
	}
}

/**
 * Determines if it is a stub file, and if there is a destination, returns its path/reference.
 */
function parseStubTarget(content: string): string | undefined {
	// E.g.: **Moved To**: `@scope/pkg:105`\n`packages/pkg/docs/decisions/105-xxx.md`
	const match = content.match(/\*\*Moved To\*\*:\s*`([^`]+)`/);
	return match?.[1];
}

export function suggestClosest(input: string, candidates: readonly string[], limit = 5): string[] {
	const lower = input.toLowerCase();
	const matched = candidates.filter(
		(c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()),
	);
	if (matched.length > 0) {
		return matched.slice(0, limit);
	}
	return candidates.slice(0, limit);
}

export async function resolveDocRef(
	repoRoot: string,
	docType: DocType,
	ref: string,
	packages?: ReadonlyArray<PackageEntry>,
	decisionDir: string = 'docs/decisions',
	taskDir: string = 'docs/task',
	startNumber: number = 200,
): Promise<ResolvedDoc> {
	const subDir = docType === 'decision' ? decisionDir : taskDir;
	const pkgs = packages ?? (await discoverPackages(repoRoot));

	// 1. bare number (e.g. "105", "063")
	if (/^\d+$/.test(ref)) {
		const num = Number(ref);
		if (num >= startNumber) {
			throw new Error(
				`References >= ${startNumber} must be namespaced (e.g. @myorg/core:${ref} or root:${ref})`,
			);
		}

		const rootDir = join(repoRoot, subDir);
		const filePath = await findNumberedFile(rootDir, num);
		if (!filePath) {
			const existing = await listNumberedFiles(rootDir);
			const suggestions = suggestClosest(ref, existing);
			const hint = suggestions.length > 0 ? ` (Did you mean: ${suggestions.join(', ')})` : '';
			throw new Error(`${docType} not found: ${ref}${hint}`);
		}

		const rawContent = await readFile(filePath, 'utf8');
		const stubTarget = parseStubTarget(rawContent);
		if (stubTarget) {
			// If it is a stub, resolve and display the destination
			if (stubTarget.includes(':')) {
				return await resolveDocRef(repoRoot, docType, stubTarget, pkgs, decisionDir, taskDir);
			}
			const targetPath = join(repoRoot, stubTarget);
			const targetContent = await readFile(targetPath, 'utf8');
			return {
				reference: ref,
				filePath: targetPath,
				content: targetContent,
			};
		}

		return {
			reference: `root:${String(num).padStart(3, '0')}`,
			filePath,
			content: rawContent,
		};
	}

	// 2. namespaced reference (e.g. "@scope/targetlib-schemaui:200", "scope:200")
	if (ref.includes(':')) {
		const colonIdx = ref.lastIndexOf(':');
		const pkgName = ref.slice(0, colonIdx);
		const numStr = ref.slice(colonIdx + 1);
		const num = Number(numStr);

		if (Number.isNaN(num)) {
			throw new Error(`Invalid reference format: ${ref} (expected e.g. 105 or @myorg/core:200)`);
		}

		const pkgEntry = pkgs.find((p) => p.name === pkgName);
		if (!pkgEntry) {
			const pkgNames = pkgs.map((p) => p.name);
			const suggestions = suggestClosest(pkgName, pkgNames);
			const hint = suggestions.length > 0 ? ` (Did you mean: ${suggestions.join(', ')})` : '';
			throw new Error(`Package not found: ${pkgName}${hint}`);
		}

		const docDir = join(pkgEntry.dir, subDir);
		const filePath = await findNumberedFile(docDir, num);
		if (!filePath) {
			const existing = await listNumberedFiles(docDir);
			const suggestions = suggestClosest(numStr, existing);
			const hint =
				suggestions.length > 0 ? ` (Suggestions in this package: ${suggestions.join(', ')})` : '';
			throw new Error(`${docType} not found: ${ref}${hint}`);
		}

		const content = await readFile(filePath, 'utf8');
		return {
			reference: ref,
			filePath,
			content,
		};
	}

	throw new Error(`Invalid reference format: ${ref} (expected e.g. 105 or @myorg/core:200)`);
}

export async function runShow(
	repoRoot: string,
	docType: string | undefined,
	refs: string[],
): Promise<void> {
	if (docType !== 'decision' && docType !== 'task') {
		console.error('Usage: spec-tools doc-ref show <decision|task> <ref> [ref...]');
		process.exitCode = 2;
		return;
	}

	if (refs.length === 0) {
		console.error(`Usage: spec-tools doc-ref show ${docType} <ref> [ref...]`);
		console.error(`  Example: spec-tools doc-ref show ${docType} 105`);
		console.error(`           spec-tools doc-ref show ${docType} @scope/pkg:200`);
		process.exitCode = 2;
		return;
	}

	let missing = false;
	const pkgs = await discoverPackages(repoRoot);

	const fullConfig = (await import('../../config.ts')).loadConfig(repoRoot);
	const decisionDir = fullConfig.docRef?.decisionDir ?? 'docs/decisions';
	const taskDir = fullConfig.docRef?.taskDir ?? 'docs/task';

	for (const ref of refs) {
		try {
			const resolved = await resolveDocRef(
				repoRoot,
				docType,
				ref,
				pkgs,
				decisionDir,
				taskDir,
				fullConfig.scaffold?.startNumber,
			);
			const relPath = relative(repoRoot, resolved.filePath);
			console.log(`# ${resolved.reference} (${relPath})\n`);
			console.log(resolved.content.trimEnd());
			console.log('');
		} catch (err) {
			missing = true;
			console.error(err instanceof Error ? err.message : String(err));
		}
	}

	if (missing) {
		process.exitCode = 1;
	}
}

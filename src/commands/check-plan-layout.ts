import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadConfig } from '../config.ts';

function walk(dir: string): string[] {
	const files: string[] = [];
	try {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				files.push(...walk(path));
			} else if (entry.isFile() && entry.name.endsWith('.md')) {
				files.push(path);
			}
		}
	} catch (_e) {
		// Ignore if directory doesn't exist
	}
	return files;
}

function exists(path: string): boolean {
	try {
		statSync(path);
		return true;
	} catch {
		return false;
	}
}

function isForbiddenPlanFile(relativePath: string): boolean {
	return /(^|\/)phase\d+edit\.md$/.test(relativePath);
}

function extractPlanPaths(text: string, planDir: string): string[] {
	// Escape planDir for regex
	const escapedDir = planDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(`${escapedDir}\\/[\\w./_-]*\\.md`, 'g');
	return [...new Set(text.match(re) ?? [])];
}

function planPathCandidates(planPath: string, planDir: string): string[] {
	// match `planDir/<version>/phase<N>.md` to `planDir/<version>/done/phase<N>.md`
	const escapedDir = planDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = new RegExp(`^(${escapedDir}\\/[^/]+)\\/(phase\\d+\\.md)$`).exec(planPath);
	if (!match?.[1] || !match[2]) {
		return [planPath];
	}
	return [planPath, `${match[1]}/done/${match[2]}`];
}

export function runCheckPlanLayout(cwd: string = process.cwd()): void {
	const config = loadConfig(cwd).checkPlanLayout || {};
	const planDirName = config.planDir || 'docs/plan';
	const scanRoots = config.scanRoots || ['docs', 'spec', 'packages'];
	const rootFiles = config.rootFiles || ['README.md'];

	const planDir = join(cwd, planDirName);
	const violations: string[] = [];

	// Rule 1: No phase<N>edit.md
	if (exists(planDir)) {
		for (const file of walk(planDir)) {
			const rel = relative(cwd, file);
			if (isForbiddenPlanFile(rel)) {
				violations.push(`${rel}: Forbidden file format (e.g. phase<N>edit.md).`);
			}
		}
	}

	// Rule 2: References to plan files must exist
	const markdownFiles = [
		...scanRoots.flatMap((root) => walk(join(cwd, root))),
		...rootFiles.map((name) => join(cwd, name)).filter(exists),
	];

	let referenceCount = 0;
	for (const file of markdownFiles) {
		const text = readFileSync(file, 'utf8');
		for (const planPath of extractPlanPaths(text, planDirName)) {
			referenceCount++;
			const found = planPathCandidates(planPath, planDirName).some((candidate) =>
				exists(join(cwd, candidate)),
			);
			if (!found) {
				violations.push(`${relative(cwd, file)}: Points to non-existent plan file → ${planPath}`);
			}
		}
	}

	if (violations.length > 0) {
		console.error('check-plan-layout: Violations found');
		for (const violation of violations) {
			console.error(`  - ${violation}`);
		}
		process.exitCode = 1;
		return;
	}

	console.log(
		`check-plan-layout: 0 violations (${referenceCount} refs checked across ${markdownFiles.length} files)`,
	);
}

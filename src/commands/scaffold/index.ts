// 採番・命名を伴うファイルの生成と現在地の更新。
//
//   pnpm decision:new <kebab-slug> [タイトル...]   # docs/decisions/<次番号>-<slug>.md
//   pnpm task:new <kebab-slug> [タイトル...]       # docs/task/<次番号>-<slug>.md
//   pnpm acceptance:new                            # docs/acceptance/phase-v<版>-<Phase>.md
//   pnpm phase:set v0_2_25                         # spec/PHASE を更新
//
// 番号とファイル名を人(や AI)が数えないための入口である(docs/decisions/089)。

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { discoverPackages } from '../doc-ref/closure.ts';
import { suggestClosest } from '../doc-ref/show.ts';
import { parseImplPoint } from '../spec-coverage/implPoint.ts';
import {
	acceptanceFileFor,
	acceptanceTemplate,
	decisionTemplate,
	nextNumber,
	numberedFileName,
	planFileFor,
	SLUG_RE,
	taskTemplate,
} from './naming.ts';

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

function writeNew(path: string, content: string): void {
	if (existsSync(path)) {
		fail(`Already exists: ${path}`);
	}
	writeFileSync(path, content, 'utf8');
}

function currentPoint(repoRoot: string) {
	const PHASE_FILE = join(repoRoot, 'spec/PHASE');
	if (!existsSync(PHASE_FILE)) {
		fail(`spec/PHASE not found. Please create it first.`);
	}
	const token = readFileSync(PHASE_FILE, 'utf8').trim();
	const point = parseImplPoint(token);
	if (!point) {
		fail(`Invalid format in spec/PHASE: ${token}`);
	}
	return point;
}

async function cmdDecision(
	repoRoot: string,
	args: readonly string[],
	packageName?: string,
): Promise<void> {
	const remainingArgs = args;
	const slug = remainingArgs[0];
	if (!slug) {
		fail('Usage: spec-tools scaffold decision [--package <name>] <kebab-slug> [title...]');
	}
	if (!SLUG_RE.test(slug)) {
		fail(`Slug must be lowercase alphanumeric and hyphens: ${slug}`);
	}
	const title = remainingArgs.slice(1).join(' ') || slug;

	let targetDir = join(repoRoot, 'docs/decisions');
	let namespace = 'root';

	if (packageName) {
		const pkgs = await discoverPackages(repoRoot);
		const pkg = pkgs.find((p) => p.name === packageName);
		if (!pkg) {
			const suggestions = suggestClosest(
				packageName,
				pkgs.map((p) => p.name),
			);
			const hint = suggestions.length > 0 ? ` (Did you mean: ${suggestions.join(', ')})` : '';
			fail(`Package not found: ${packageName}${hint}`);
		}
		targetDir = join(pkg.dir, 'docs', 'decisions');
		namespace = pkg.name;
	}

	if (!existsSync(targetDir)) {
		mkdirSync(targetDir, { recursive: true });
	}

	const numberValue = nextNumber(readdirSync(targetDir));
	const fileName = numberedFileName(numberValue, slug);
	const filePath = join(targetDir, fileName);
	writeNew(filePath, decisionTemplate(numberValue, title, today()));
	const relPath = relative(repoRoot, filePath);
	console.log(`Created ${relPath} (${namespace}:${numberValue}).`);
}

async function cmdTask(
	repoRoot: string,
	args: readonly string[],
	packageName?: string,
): Promise<void> {
	const remainingArgs = args;
	const slug = remainingArgs[0];
	if (!slug) {
		fail('Usage: spec-tools scaffold task [--package <name>] <kebab-slug> [title...]');
	}
	if (!SLUG_RE.test(slug)) {
		fail(`Slug must be lowercase alphanumeric and hyphens: ${slug}`);
	}
	const title = remainingArgs.slice(1).join(' ') || slug;

	let targetDir = join(repoRoot, 'docs/task');
	let namespace = 'root';

	if (packageName) {
		const pkgs = await discoverPackages(repoRoot);
		const pkg = pkgs.find((p) => p.name === packageName);
		if (!pkg) {
			const suggestions = suggestClosest(
				packageName,
				pkgs.map((p) => p.name),
			);
			const hint = suggestions.length > 0 ? ` (Did you mean: ${suggestions.join(', ')})` : '';
			fail(`Package not found: ${packageName}${hint}`);
		}
		targetDir = join(pkg.dir, 'docs', 'task');
		namespace = pkg.name;
	}

	if (!existsSync(targetDir)) {
		mkdirSync(targetDir, { recursive: true });
	}

	const numberValue = nextNumber(readdirSync(targetDir));
	const fileName = numberedFileName(numberValue, slug);
	const filePath = join(targetDir, fileName);
	writeNew(filePath, taskTemplate(numberValue, title, today()));
	const relPath = relative(repoRoot, filePath);
	console.log(`Created ${relPath} (${namespace}:${numberValue}).`);
}

function cmdAcceptance(repoRoot: string): void {
	const point = currentPoint(repoRoot);
	const relPath = acceptanceFileFor(point);
	const path = join(repoRoot, relPath);
	writeNew(path, acceptanceTemplate(point, today()));
	console.log(`Created ${relPath} (from spec/PHASE).`);
	const planFile = planFileFor(point);
	if (!existsSync(join(repoRoot, planFile))) {
		console.log(`  ⚠ Plan original ${planFile} not found.`);
	}
}

function cmdPhase(repoRoot: string, args: readonly string[]): void {
	const token = args[0];
	if (!token) {
		fail('Usage: spec-tools scaffold phase v<major>_<minor>_<phase> (e.g., v0_2_25)');
	}
	const point = parseImplPoint(token);
	if (!point) {
		fail(`Invalid format: ${token} (must be v<major>_<minor>_<phase>)`);
	}
	const PHASE_FILE = join(repoRoot, 'spec/PHASE');
	const before = existsSync(PHASE_FILE) ? readFileSync(PHASE_FILE, 'utf8').trim() : 'None';
	writeFileSync(PHASE_FILE, `${token}\n`, 'utf8');
	console.log(`spec/PHASE: ${before} → ${token}`);
}

export async function runScaffold(
	repoRoot: string = process.cwd(),
	args: string[],
	packageName?: string,
): Promise<void> {
	const [command, ...subArgs] = args;
	switch (command) {
		case 'decision':
			await cmdDecision(repoRoot, subArgs, packageName);
			return;
		case 'task':
			await cmdTask(repoRoot, subArgs, packageName);
			return;
		case 'acceptance':
			cmdAcceptance(repoRoot);
			return;
		case 'phase':
			cmdPhase(repoRoot, subArgs);
			return;
		default:
			fail(
				`Unknown sub-command: ${command ?? '(none)'}\nUsage: spec-tools scaffold <decision|task|acceptance|phase>`,
			);
	}
}

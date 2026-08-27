// 採番・命名を伴うファイルの生成と現在地の更新。
//
//   pnpm decision:new <kebab-slug> [タイトル...]   # docs/decisions/<次番号>-<slug>.md
//   pnpm task:new <kebab-slug> [タイトル...]       # docs/task/<次番号>-<slug>.md
//   pnpm acceptance:new                            # docs/acceptance/phase-v<版>-<Phase>.md
//   pnpm phase:set v0_2_25                         # spec/PHASE を更新
//
// 番号とファイル名を人(や AI)が数えないための入口である(docs/decisions/089)。

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
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

function getPackageRoot(startDir: string): string {
	let current = startDir;
	while (current !== dirname(current)) {
		if (existsSync(join(current, 'package.json'))) {
			return current;
		}
		current = dirname(current);
	}
	return startDir;
}

async function resolveTemplate(
	repoRoot: string,
	templateDir: string | undefined,
	templateName: string,
	fallbackGenerator: () => string,
): Promise<string> {
	if (templateDir) {
		const customPath = join(repoRoot, templateDir, templateName);
		if (existsSync(customPath)) {
			return readFileSync(customPath, 'utf8');
		}
	}
	const fileDir = dirname(fileURLToPath(import.meta.url));
	const pkgRoot = getPackageRoot(fileDir);
	const defaultPath = join(pkgRoot, 'templates', templateName);
	if (existsSync(defaultPath)) {
		return readFileSync(defaultPath, 'utf8');
	}
	return fallbackGenerator();
}

async function cmdDecision(
	repoRoot: string,
	args: readonly string[],
	decisionDir: string,
	packageName?: string,
	scaffoldConfig?: { templateDir?: string; startNumber?: number },
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

	let targetDir = join(repoRoot, decisionDir);
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
		targetDir = join(pkg.dir, decisionDir);
		namespace = pkg.name;
	}

	if (!existsSync(targetDir)) {
		mkdirSync(targetDir, { recursive: true });
	}

	const numberValue = nextNumber(readdirSync(targetDir), scaffoldConfig?.startNumber);
	const fileName = numberedFileName(numberValue, slug);
	const filePath = join(targetDir, fileName);

	const template = await resolveTemplate(repoRoot, scaffoldConfig?.templateDir, 'decision.md', () =>
		decisionTemplate(numberValue, title, today()),
	);
	const content = template
		.replace(/\{\{number\}\}/g, String(numberValue).padStart(3, '0'))
		.replace(/\{\{title\}\}/g, title)
		.replace(/\{\{date\}\}/g, today());

	writeNew(filePath, content);
	const relPath = relative(repoRoot, filePath);
	console.log(`Created ${relPath} (${namespace}:${numberValue}).`);
}

async function cmdTask(
	repoRoot: string,
	args: readonly string[],
	taskDir: string,
	packageName?: string,
	scaffoldConfig?: { templateDir?: string; startNumber?: number },
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

	let targetDir = join(repoRoot, taskDir);
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
		targetDir = join(pkg.dir, taskDir);
		namespace = pkg.name;
	}

	if (!existsSync(targetDir)) {
		mkdirSync(targetDir, { recursive: true });
	}

	const numberValue = nextNumber(readdirSync(targetDir), scaffoldConfig?.startNumber);
	const fileName = numberedFileName(numberValue, slug);
	const filePath = join(targetDir, fileName);

	const template = await resolveTemplate(repoRoot, scaffoldConfig?.templateDir, 'task.md', () =>
		taskTemplate(numberValue, title, today()),
	);
	const content = template
		.replace(/\{\{number\}\}/g, String(numberValue).padStart(3, '0'))
		.replace(/\{\{title\}\}/g, title)
		.replace(/\{\{date\}\}/g, today());

	writeNew(filePath, content);
	const relPath = relative(repoRoot, filePath);
	console.log(`Created ${relPath} (${namespace}:${numberValue}).`);
}

async function cmdAcceptance(
	repoRoot: string,
	scaffoldConfig?: {
		templateDir?: string;
		startNumber?: number;
		planDirTemplate?: string;
		planFileTemplate?: string;
		acceptanceFileTemplate?: string;
	},
): Promise<void> {
	const point = currentPoint(repoRoot);
	const relPath = acceptanceFileFor(point, scaffoldConfig);
	const path = join(repoRoot, relPath);
	const planFile = planFileFor(point, scaffoldConfig);

	const template = await resolveTemplate(
		repoRoot,
		scaffoldConfig?.templateDir,
		'acceptance.md',
		() => acceptanceTemplate(point, today(), scaffoldConfig),
	);
	const content = template
		.replace(/\{\{major\}\}/g, String(point.major))
		.replace(/\{\{minor\}\}/g, String(point.minor))
		.replace(/\{\{phase\}\}/g, String(point.phase))
		.replace(/\{\{date\}\}/g, today())
		.replace(/\{\{planFile\}\}/g, planFile);

	writeNew(path, content);
	console.log(`Created ${relPath} (from spec/PHASE).`);
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
	const fullConfig = (await import('../../config.ts')).loadConfig(repoRoot);
	const decisionDir = fullConfig.docRef?.decisionDir ?? 'docs/decisions';
	const taskDir = fullConfig.docRef?.taskDir ?? 'docs/task';

	const [command, ...subArgs] = args;
	switch (command) {
		case 'decision':
			await cmdDecision(repoRoot, subArgs, decisionDir, packageName, fullConfig.scaffold);
			return;
		case 'task':
			await cmdTask(repoRoot, subArgs, taskDir, packageName, fullConfig.scaffold);
			return;
		case 'acceptance':
			await cmdAcceptance(repoRoot, fullConfig.scaffold);
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

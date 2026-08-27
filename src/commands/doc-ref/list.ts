// decisions / task の一覧。依存閉包を走査して、実体の在り処ごとに並べる。
// 正本は docs/decisions/109 決定4・決定8 / docs/plan/0_3/done/phase8.md R3。
//
//   pnpm task:list
//   pnpm task:list --package @kata2/core
//
// 一覧(索引)は実体を持つ側の docs/task/INDEX.md が持つ(tools/doc-ref/src/indexGen.ts)。
// こちらは依存閉包を横断して見るための出力である。
// docs/task/README.md に残るのは「どれを先にやるか」の表だけ(決定8)。

import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { discoverPackages, type PackageEntry } from './closure.ts';
import type { DocType } from './show.ts';

// ファイル名に `_` を含む legacy が在る(036-v0_2-after-tasks.md)。
const NUMBERED_FILE_RE = /^(\d{3})-[a-z0-9_-]+\.md$/;
const STUB_RE = /\*\*移設先\*\*:\s*`([^`]+)`/;

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

function firstState(content: string): string {
	const m = content.match(/^\*\*状態\*\*:\s*(.+)$/m);
	if (!m?.[1]) {
		return '—';
	}
	// 太字・リンクを落として1行に畳む
	return m[1].replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * repoRoot 起点で、根と依存閉包内のすべての package の docs/<subDir>/ を走査する。
 * 根の stub(移設先を指すもの)は実体側に畳み、一覧には出さない。
 */
export function collectDocs(
	repoRoot: string,
	docType: DocType,
	packages: ReadonlyArray<PackageEntry>,
	decisionDir: string = 'docs/decisions',
	taskDir: string = 'docs/task',
): DocEntry[] {
	const subDir = docType === 'decision' ? decisionDir : taskDir;
	const entries: DocEntry[] = [];
	// discoverPackages は realpath で畳むので、根の判定も realpath で揃える(macOS の /var → /private/var)。
	const realRoot = realpathSync(repoRoot);

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
			const isStub = STUB_RE.test(content);
			if (isStub) {
				// 実体は移設先の package 側で拾う
				continue;
			}
			const bare = isRoot && Number(num) < 200; // Legacy limitation is hardcoded to 200 for now or maybe we don't care
			entries.push({
				owner: pkg.name,
				reference: bare ? num : `${pkg.name}:${num}`,
				number: num,
				title: firstTitle(content),
				state: firstState(content),
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
		// kata2(根)を先頭に、以降は名前順
		if (a.includes('/') !== b.includes('/')) {
			return a.includes('/') ? 1 : -1;
		}
		return a.localeCompare(b);
	});

	const lines: string[] = [
		`# ${docType} 一覧(依存閉包の走査。実体の在り処ごと。計 ${entries.length}件)`,
		'',
	];
	for (const owner of owners) {
		const list = (byOwner.get(owner) ?? []).sort((a, b) => a.number.localeCompare(b.number));
		lines.push(`## ${owner}(${list.length}件)`);
		const width = Math.max(...list.map((e) => e.reference.length));
		for (const e of list) {
			lines.push(`  ${e.reference.padEnd(width)}  ${e.title}`);
			lines.push(`  ${' '.repeat(width)}  状態: ${e.state}`);
			lines.push(`  ${' '.repeat(width)}  ${relative(repoRoot, e.filePath)}`);
		}
		lines.push('');
	}
	lines.push(
		`本文を読むのは \`pnpm ${docType}:show <参照>\`。`,
		docType === 'task'
			? `着手順の判断は ${taskDir}/README.md の表が持つ(docs/decisions/109 決定8)。`
			: '',
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

	const entries = collectDocs(repoRoot, docType, target, decisionDir, taskDir);
	console.log(render(repoRoot, docType, entries, taskDir));
}

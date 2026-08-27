// task / decisions 一覧のテスト。
// 正本は docs/decisions/109 決定8 / docs/plan/0_3/done/phase8.md R3。
//
// テスト名に条項 ID を置いていないのは意図的(tools/ は問い1 の対象外)。

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverPackages } from './closure.ts';
import { collectDocs } from './list.ts';

const _REPO_ROOT = resolve(import.meta.dirname, '../../..');

async function createFixtureRepo(): Promise<string> {
	const repo = await mkdtemp(join(tmpdir(), 'kata2-doc-list-'));
	await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');
	await writeFile(join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n', 'utf8');
	return repo;
}

describe('collectDocs', () => {
	it('根の stub を実体側へ畳み、二重に数えない', async () => {
		const repo = await createFixtureRepo();
		const rootTask = join(repo, 'docs', 'task');
		await mkdir(rootTask, { recursive: true });
		await writeFile(
			join(rootTask, '046-moved.md'),
			'# 046 移設済み\n\n**移設先**: `@kata2/core:046`\n',
			'utf8',
		);
		await writeFile(
			join(rootTask, '051-stays.md'),
			'# 051 kata2 に残る\n\n**状態**: 未着手\n',
			'utf8',
		);

		const pkgDir = join(repo, 'packages', 'core');
		await mkdir(join(pkgDir, 'docs', 'task'), { recursive: true });
		await writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@kata2/core' }), 'utf8');
		await writeFile(
			join(pkgDir, 'docs', 'task', '046-moved.md'),
			'# 046 移設済み\n\n**状態**: 未着手\n',
			'utf8',
		);

		const packages = await discoverPackages(repo);
		const entries = collectDocs(repo, 'task', packages);

		expect(entries.map((e) => e.reference).sort()).toEqual(['051', '@kata2/core:046']);
		expect(entries.filter((e) => e.number === '046')).toHaveLength(1);
	});

	it('根の legacy は bare 番号、package の実体は名前空間付きで参照を出す', async () => {
		const repo = await createFixtureRepo();
		const rootTask = join(repo, 'docs', 'task');
		await mkdir(rootTask, { recursive: true });
		await writeFile(join(rootTask, '051-stays.md'), '# 051 legacy\n', 'utf8');
		await writeFile(join(rootTask, '201-native.md'), '# 201 native\n', 'utf8');

		const packages = await discoverPackages(repo);
		const entries = collectDocs(repo, 'task', packages);

		expect(entries.map((e) => e.reference).sort()).toEqual(['051', 'kata2:201']);
	});
});

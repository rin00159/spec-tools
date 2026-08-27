// task 索引(docs/task/INDEX.md)の生成のテスト。
// 正本は spec/00-conventions.md「kata2 の役割と正本の優先順位」/ docs/decisions/110 決定4。
//
// テスト名に条項 ID を置いていないのは意図的(tools/ は問い1 の対象外)。

import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverPackages } from './closure.ts';
import { planIndexes } from './indexGen.ts';

const _REPO_ROOT = resolve(import.meta.dirname, '../../..');

async function createFixtureRepo(): Promise<string> {
	// macOS の /var → /private/var を畳む(discoverPackages は realpath を返す)。
	const repo = realpathSync(await mkdtemp(join(tmpdir(), 'kata2-task-index-')));
	await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');
	await writeFile(join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n', 'utf8');
	return repo;
}

async function writeTask(dir: string, name: string, body: string): Promise<void> {
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, name), body, 'utf8');
}

describe('planIndexes', () => {
	it('実体を持つ側ごとに索引を作り、根の stub は載せない', async () => {
		const repo = await createFixtureRepo();
		await writeTask(
			join(repo, 'docs', 'task'),
			'046-moved.md',
			'# 046 移設済み\n\n**移設先**: `@kata2/core:046`\n',
		);
		await writeTask(
			join(repo, 'docs', 'task'),
			'051-stays.md',
			'# 051 kata2 に残る\n\n**状態**: 未着手\n',
		);
		const pkgDir = join(repo, 'packages', 'core');
		await mkdir(pkgDir, { recursive: true });
		await writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@kata2/core' }), 'utf8');
		await writeTask(
			join(pkgDir, 'docs', 'task'),
			'046-moved.md',
			'# 046 移設済み\n\n**状態**: 未着手\n',
		);

		const packages = await discoverPackages(repo);
		const { writes, removals } = planIndexes(repo, 'task', packages);

		expect(removals).toEqual([]);
		const paths = writes.map((w) => relative(repo, w.path)).sort();
		expect(paths).toEqual([
			join('docs', 'task', 'INDEX.md'),
			join('packages', 'core', 'docs', 'task', 'INDEX.md'),
		]);

		const root = writes.find((w) => w.path === join(repo, 'docs', 'task', 'INDEX.md'));
		expect(root?.content).toContain('051');
		// 根の stub は実体側で数える。根の索引には出ない。
		expect(root?.content).not.toContain('046');
		expect(root?.content).toContain('手で編集しない');
	});

	it('実体が0件になった索引は削除の対象になる', async () => {
		const repo = await createFixtureRepo();
		await writeTask(
			join(repo, 'docs', 'task'),
			'046-moved.md',
			'# 046 移設済み\n\n**移設先**: `@kata2/core:046`\n',
		);
		// 根は stub だけ。旧い索引が残っている状態を作る。
		await writeFile(join(repo, 'docs', 'task', 'INDEX.md'), '# task 索引 — kata2(1件)\n', 'utf8');

		const packages = await discoverPackages(repo);
		const { writes, removals } = planIndexes(repo, 'task', packages);

		expect(writes).toEqual([]);
		expect(removals.map((p) => relative(repo, p))).toEqual([join('docs', 'task', 'INDEX.md')]);
	});
});

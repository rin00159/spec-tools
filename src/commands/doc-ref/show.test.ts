// decisions / task 参照解決のテスト。
// 正本は docs/decisions/109 決定4 / docs/plan/0_3/phase5.md Scope 6。
//
// テスト名に条項 ID を置いていないのは意図的(tools/ は問い1 の対象外)。

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDocRef } from './show.ts';

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), 'kata2-doc-show-'));
}

describe('resolveDocRef', () => {
	it('legacy の bare 番号は root の docs/decisions から解決する', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');
		const decisionsDir = join(repo, 'docs', 'decisions');
		await mkdir(decisionsDir, { recursive: true });
		await writeFile(
			join(decisionsDir, '105-fch-artifact.md'),
			'# 105 FCH の生成物の形\n\n本文105',
			'utf8',
		);

		const resolved = await resolveDocRef(repo, 'decision', '105');
		expect(resolved.content).toContain('# 105 FCH の生成物の形');
		expect(resolved.reference).toBe('root:105');
	});

	it('200 以降の bare 番号は error にする', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');
		await expect(resolveDocRef(repo, 'decision', '200')).rejects.toThrow(/must be namespaced/);
	});

	it('名前空間付き参照 (@kata2/pkg:200) を解決する', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');
		const pkgDir = join(repo, 'packages', 'schemaui');
		const decisionsDir = join(pkgDir, 'docs', 'decisions');
		await mkdir(decisionsDir, { recursive: true });
		await writeFile(
			join(pkgDir, 'package.json'),
			JSON.stringify({ name: '@kata2/schemaui' }),
			'utf8',
		);
		await writeFile(
			join(decisionsDir, '200-new-decision.md'),
			'# 200 新しい決定\n\n本文200',
			'utf8',
		);

		const resolved = await resolveDocRef(repo, 'decision', '@kata2/schemaui:200');
		expect(resolved.content).toContain('# 200 新しい決定');
		expect(resolved.reference).toBe('@kata2/schemaui:200');
	});

	it('stub ファイルの場合は移設先の本文を解決して返す', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');
		const rootDecisionsDir = join(repo, 'docs', 'decisions');
		await mkdir(rootDecisionsDir, { recursive: true });

		const pkgDir = join(repo, 'packages', 'html');
		const pkgDecisionsDir = join(pkgDir, 'docs', 'decisions');
		await mkdir(pkgDecisionsDir, { recursive: true });
		await writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@kata2/html' }), 'utf8');
		await writeFile(
			join(pkgDecisionsDir, '105-fch-shape.md'),
			'# 105 FCH の生成物の形(実体)\n\n移設先本文',
			'utf8',
		);

		// stub を root に置く
		await writeFile(
			join(rootDecisionsDir, '105-fch-shape.md'),
			`# 105 FCH の生成物の形\n\n**移設先**: \`@kata2/html:105\`\n`,
			'utf8',
		);

		const resolved = await resolveDocRef(repo, 'decision', '105');
		expect(resolved.content).toContain('移設先本文');
	});
});

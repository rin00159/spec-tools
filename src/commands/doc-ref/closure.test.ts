// 依存閉包の走査とパッケージ発見のテスト。
// 正本は docs/decisions/109 決定4 / docs/plan/0_3/phase5.md Scope 6。
//
// テスト名に条項 ID を置いていないのは意図的(tools/ は問い1 の対象外)。

import { mkdir, mkdtemp, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverPackages } from './closure.ts';

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), 'kata2-doc-closure-'));
}

describe('discoverPackages', () => {
	it('workspace 内の packages と root を列挙する', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');

		const pkgADir = join(repo, 'packages', 'a');
		await mkdir(pkgADir, { recursive: true });
		await writeFile(join(pkgADir, 'package.json'), JSON.stringify({ name: '@kata2/a' }), 'utf8');

		const packages = await discoverPackages(repo);
		const names = packages.map((p) => p.name);
		expect(names).toContain('kata2');
		expect(names).toContain('@kata2/a');
	});

	it('node_modules の symlink 経由でしか到達できない外部パッケージを発見し、symlink 削除で結果が変わる (R5)', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');

		// workspace の外(例: external-libs/ext-lib)に置かれたパッケージ
		const extDir = join(repo, 'external-libs', 'ext-lib');
		await mkdir(extDir, { recursive: true });
		await writeFile(join(extDir, 'package.json'), JSON.stringify({ name: '@ext/lib' }), 'utf8');

		// packages/cli が node_modules/@ext/lib として symlink で参照
		const pkgCli = join(repo, 'packages', 'cli');
		const cliNodeModulesScope = join(pkgCli, 'node_modules', '@ext');
		await mkdir(cliNodeModulesScope, { recursive: true });
		await writeFile(join(pkgCli, 'package.json'), JSON.stringify({ name: '@kata2/cli' }), 'utf8');

		const symlinkPath = join(cliNodeModulesScope, 'lib');
		await symlink(extDir, symlinkPath, 'dir');

		// 1. symlink がある状態では @ext/lib が発見される
		const pkgsWithSymlink = await discoverPackages(repo);
		expect(pkgsWithSymlink.map((p) => p.name)).toContain('@ext/lib');

		// 2. symlink を消すと @ext/lib が発見されなくなる(symlink を辿っていたことの証跡)
		await unlink(symlinkPath);
		const pkgsWithoutSymlink = await discoverPackages(repo);
		expect(pkgsWithoutSymlink.map((p) => p.name)).not.toContain('@ext/lib');
	});

	it('glob と symlink の両方から同一パッケージを踏んでも 1件に畳まれる (R5)', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');

		const pkgCore = join(repo, 'packages', 'core');
		await mkdir(pkgCore, { recursive: true });
		await writeFile(join(pkgCore, 'package.json'), JSON.stringify({ name: '@kata2/core' }), 'utf8');

		const pkgCli = join(repo, 'packages', 'cli');
		const cliNodeModules = join(pkgCli, 'node_modules', '@kata2');
		await mkdir(cliNodeModules, { recursive: true });
		await writeFile(join(pkgCli, 'package.json'), JSON.stringify({ name: '@kata2/cli' }), 'utf8');

		// cli の node_modules/@kata2/core -> packages/core への symlink
		await symlink(pkgCore, join(cliNodeModules, 'core'), 'dir');

		const packages = await discoverPackages(repo);
		const coreEntries = packages.filter((p) => p.name === '@kata2/core');
		expect(coreEntries).toHaveLength(1);
	});

	it('文書を持つ package で異なる realpath が同じ name を名乗った場合は throw する', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');

		const pkgA = join(repo, 'packages', 'a');
		const pkgB = join(repo, 'packages', 'b');
		await mkdir(join(pkgA, 'docs', 'decisions'), { recursive: true });
		await mkdir(join(pkgB, 'docs', 'decisions'), { recursive: true });
		await writeFile(
			join(pkgA, 'package.json'),
			JSON.stringify({ name: '@kata2/conflict' }),
			'utf8',
		);
		await writeFile(
			join(pkgB, 'package.json'),
			JSON.stringify({ name: '@kata2/conflict' }),
			'utf8',
		);

		await expect(discoverPackages(repo)).rejects.toThrow(/同じ package 名/);
	});

	it('文書を持たない第三者 package で異なる realpath が同じ name を名乗っても throw しない', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'kata2' }), 'utf8');

		// packages/a の node_modules/third-party (version 1)
		const pkgA = join(repo, 'packages', 'a');
		const thirdPartyA = join(pkgA, 'node_modules', 'third-party');
		await mkdir(thirdPartyA, { recursive: true });
		await writeFile(join(pkgA, 'package.json'), JSON.stringify({ name: '@kata2/a' }), 'utf8');
		await writeFile(
			join(thirdPartyA, 'package.json'),
			JSON.stringify({ name: 'third-party', version: '1.0.0' }),
			'utf8',
		);

		// packages/b の node_modules/third-party (version 2)
		const pkgB = join(repo, 'packages', 'b');
		const thirdPartyB = join(pkgB, 'node_modules', 'third-party');
		await mkdir(thirdPartyB, { recursive: true });
		await writeFile(join(pkgB, 'package.json'), JSON.stringify({ name: '@kata2/b' }), 'utf8');
		await writeFile(
			join(thirdPartyB, 'package.json'),
			JSON.stringify({ name: 'third-party', version: '2.0.0' }),
			'utf8',
		);

		// 文書ディレクトリを持たないため throw せずに成功する
		const packages = await discoverPackages(repo);
		const thirdPartyEntries = packages.filter((p) => p.name === 'third-party');
		expect(thirdPartyEntries).toHaveLength(1);
	});
});

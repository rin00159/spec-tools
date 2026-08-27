// 条項ファイルの走査ルート(根の spec/ と packages/*/docs/spec/)を発見する。
// 正本は spec/00-conventions.md「条項ファイルの置き場と走査ルート」。

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function isDirectory(path: string): Promise<boolean> {
	try {
		const s = await stat(path);
		return s.isDirectory();
	} catch {
		return false;
	}
}

// 条項ファイルの走査ルートを発見する。
// 根の spec/ と packages/<pkg>/docs/spec/ を glob 的に探索し、
// 実在するルートの絶対パスを昇順で返す。
// package 名は直書きせず、ディレクトリ走査で発見する。
// 発見したルートが0件のときは throw する(空振り防止)。
export async function discoverSpecRoots(repoRoot: string): Promise<ReadonlyArray<string>> {
	const roots: string[] = [];

	const rootSpec = join(repoRoot, 'spec');
	if (await isDirectory(rootSpec)) {
		roots.push(rootSpec);
	}

	const packagesDir = join(repoRoot, 'packages');
	if (await isDirectory(packagesDir)) {
		const entries = await readdir(packagesDir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const pkgSpec = join(packagesDir, entry.name, 'docs', 'spec');
				if (await isDirectory(pkgSpec)) {
					roots.push(pkgSpec);
				}
			}
		}
	}

	if (roots.length === 0) {
		throw new Error('条項の走査ルートが0件(00-conventions.md「走査が空振りしたときは失敗する」)');
	}

	return roots.sort();
}

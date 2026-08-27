// 現在地(到達済みの版・Phase)の解決。正本は spec/00-conventions.md「現在地の在処」。
//
// 現在地は `spec/PHASE` 1箇所にだけ置く。`--phase` は一時的な上書き専用で、
// **複数指定は error**(黙って先頭/末尾を採ると、打った値が無視されたことに気づけない)。

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type ImplPoint, parseImplPoint } from './implPoint.ts';

export const PHASE_FILE_NAME = 'PHASE';

/**
 * `--phase` の上書き指定を1つだけ取り出す。
 * 未指定なら undefined。**複数指定・値欠落・書式違反はいずれも throw**。
 */
export function readPhaseOverride(argv: readonly string[]): string | undefined {
	const indices = argv.flatMap((arg, i) => (arg === '--phase' ? [i] : []));
	if (indices.length === 0) {
		return undefined;
	}
	if (indices.length > 1) {
		const given = indices.map((i) => argv[i + 1] ?? '(値なし)').join(' / ');
		throw new Error(
			`--phase が ${indices.length} 回指定されている(${given})。` +
				'現在地の上書きは1回だけ許される(00-conventions.md「現在地の在処」)。' +
				'pnpm 経由で `pnpm spec:coverage --phase <値>` と打つと script 側の指定と二重になる',
		);
	}
	const index = indices[0];
	if (index === undefined) {
		return undefined;
	}
	const value = argv[index + 1];
	if (value === undefined) {
		throw new Error('--phase に値が無い(例: --phase v0_1_16)');
	}
	return value;
}

/** `spec/PHASE` を読む。存在しない・書式違反は throw。 */
export async function readPhaseFile(specDir: string): Promise<ImplPoint> {
	const path = join(specDir, PHASE_FILE_NAME);
	let raw: string;
	try {
		raw = await readFile(path, 'utf8');
	} catch {
		throw new Error(
			`${path} が読めない。現在地は ${path} に置く(00-conventions.md「現在地の在処」)`,
		);
	}
	const token = raw.trim();
	const point = parseImplPoint(token);
	if (point === undefined) {
		throw new Error(`${path} の \`${token}\` が書式違反(v<major>_<minor>_<phase>。例: v0_1_16)`);
	}
	return point;
}

export async function resolveCurrentPoint(
	argv: readonly string[],
	specDir: string,
): Promise<{ readonly point: ImplPoint; readonly overridden: boolean }> {
	const override = readPhaseOverride(argv);
	if (override === undefined) {
		return { point: await readPhaseFile(specDir), overridden: false };
	}
	const point = parseImplPoint(override);
	if (point === undefined) {
		throw new Error(`--phase の \`${override}\` が書式違反(v<major>_<minor>_<phase>。例: v0_1_16)`);
	}
	return { point, overridden: true };
}

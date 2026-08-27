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
		const given = indices.map((i) => argv[i + 1] ?? '(no value)').join(' / ');
		throw new Error(
			`--phase flag provided ${indices.length} times (${given}). Only one --phase override is allowed.`,
		);
	}
	const index = indices[0];
	if (index === undefined) {
		return undefined;
	}
	const value = argv[index + 1];
	if (value === undefined) {
		throw new Error('Missing value for --phase flag (e.g. --phase v0_1_16)');
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
			`Failed to read ${path}. The current implementation phase must be defined in this file.`,
		);
	}
	const token = raw.trim();
	const point = parseImplPoint(token);
	if (point === undefined) {
		throw new Error(
			`Invalid format in ${path}: \`${token}\`. Must be v<major>_<minor>_<phase> (e.g. v0_1_16)`,
		);
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
		throw new Error(
			`Invalid format for --phase override: \`${override}\`. Must be v<major>_<minor>_<phase> (e.g. v0_1_16)`,
		);
	}
	return { point, overridden: true };
}

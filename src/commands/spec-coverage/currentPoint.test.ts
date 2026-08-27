// 現在地の解決。正本は spec/00-conventions.md「現在地の在処」。
//
// テスト名に条項 ID を置いていないのは意図的(tools/ は問い1 の対象外。
// 00-conventions.md「先頭 ID が必須になる範囲」/ docs/decisions/026 §3)。

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPhaseFile, readPhaseOverride, resolveCurrentPoint } from './currentPoint.ts';

async function specDirWith(content: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'kata2-phase-'));
	await writeFile(join(dir, 'PHASE'), content, 'utf8');
	return dir;
}

describe('readPhaseOverride', () => {
	it('未指定なら undefined', () => {
		expect(readPhaseOverride([])).toBeUndefined();
		expect(readPhaseOverride(['--other', 'x'])).toBeUndefined();
	});

	it('1回だけの指定はその値を返す', () => {
		expect(readPhaseOverride(['--phase', 'v0_2_1'])).toBe('v0_2_1');
	});

	it('複数指定は error にする — 黙って片方を採らない', () => {
		// pnpm は script の引数の後ろへ追記するため、script 側に --phase が残っていると
		// `pnpm spec:coverage --phase X` が二重指定になる。かつては先頭が黙って勝ち、
		// 打った値が無視されていた(docs/decisions/052)。
		expect(() => readPhaseOverride(['--phase', 'v0_1_16', '--phase', 'v0_2_1'])).toThrow(
			/2 回指定/,
		);
	});

	it('値が無い指定は error にする', () => {
		expect(() => readPhaseOverride(['--phase'])).toThrow(/値が無い/);
	});
});

describe('readPhaseFile', () => {
	it('spec/PHASE のトークンを読む(前後の空白は無視)', async () => {
		const dir = await specDirWith('v0_1_16\n');
		await expect(readPhaseFile(dir)).resolves.toEqual({
			major: 0,
			minor: 1,
			phase: 16,
		});
	});

	it('旧書式(素の整数)は error にする', async () => {
		const dir = await specDirWith('16\n');
		await expect(readPhaseFile(dir)).rejects.toThrow(/書式違反/);
	});

	it('ファイルが無ければ error にする', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kata2-nophase-'));
		await expect(readPhaseFile(dir)).rejects.toThrow(/読めない/);
	});
});

describe('resolveCurrentPoint', () => {
	it('引数が無ければ spec/PHASE を使う', async () => {
		const dir = await specDirWith('v0_1_16\n');
		await expect(resolveCurrentPoint([], dir)).resolves.toEqual({
			point: { major: 0, minor: 1, phase: 16 },
			overridden: false,
		});
	});

	it('--phase は spec/PHASE より優先する', async () => {
		const dir = await specDirWith('v0_1_16\n');
		await expect(resolveCurrentPoint(['--phase', 'v0_2_1'], dir)).resolves.toEqual({
			point: { major: 0, minor: 2, phase: 1 },
			overridden: true,
		});
	});

	it('--phase の書式違反は error にする', async () => {
		const dir = await specDirWith('v0_1_16\n');
		await expect(resolveCurrentPoint(['--phase', '16'], dir)).rejects.toThrow(/書式違反/);
	});
});

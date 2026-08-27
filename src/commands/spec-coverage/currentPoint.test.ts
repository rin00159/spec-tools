// 現在地の解決。正本は spec/00-conventions.md「現在地の在処」。
//
// テスト名に条項 ID を置いていないのは意図的(tools/ は問い1 の対象外。
// 00-conventions.md「先頭 ID が必須になる範囲」/ docs/decisions/026 §3)。

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	PHASE_FILE_NAME,
	readPhaseFile,
	readPhaseOverride,
	resolveCurrentPoint,
} from './currentPoint.ts';

describe('readPhaseOverride', () => {
	it('未指定なら undefined', () => {
		expect(readPhaseOverride([])).toBeUndefined();
		expect(readPhaseOverride(['--other', 'value'])).toBeUndefined();
	});

	it('1回だけの指定はその値を返す', () => {
		expect(readPhaseOverride(['--phase', 'v0_1_16'])).toBe('v0_1_16');
	});

	it('複数指定は error にする — 黙って片方を採らない', () => {
		expect(() => readPhaseOverride(['--phase', 'v0_1_16', '--phase', 'v0_1_17'])).toThrow(
			/provided 2 times/,
		);
	});

	it('値が無い指定は error にする', () => {
		expect(() => readPhaseOverride(['--phase'])).toThrow(/Missing value/);
	});
});

describe('readPhaseFile', () => {
	it('spec/PHASE のトークンを読む(前後の空白は無視)', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await writeFile(join(dir, PHASE_FILE_NAME), '  v0_1_16 \n', 'utf8');
		const point = await readPhaseFile(dir);
		expect(point.major).toBe(0);
		expect(point.minor).toBe(1);
		expect(point.phase).toBe(16);
	});

	it('旧書式(素の整数)は error にする', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await writeFile(join(dir, PHASE_FILE_NAME), '16\n', 'utf8');
		await expect(readPhaseFile(dir)).rejects.toThrow(/Invalid format/);
	});

	it('ファイルが無ければ error にする', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await expect(readPhaseFile(dir)).rejects.toThrow(/Failed to read/);
	});
});

describe('resolveCurrentPoint', () => {
	it('引数が無ければ spec/PHASE を使う', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await writeFile(join(dir, PHASE_FILE_NAME), 'v0_1_16\n', 'utf8');
		const result = await resolveCurrentPoint([], dir);
		expect(result.point.phase).toBe(16);
		expect(result.overridden).toBe(false);
	});

	it('--phase は spec/PHASE より優先する', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await writeFile(join(dir, PHASE_FILE_NAME), 'v0_1_16\n', 'utf8');
		const result = await resolveCurrentPoint(['--phase', 'v0_2_1'], dir);
		expect(result.point.minor).toBe(2);
		expect(result.point.phase).toBe(1);
		expect(result.overridden).toBe(true);
	});

	it('--phase の書式違反は error にする', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await expect(resolveCurrentPoint(['--phase', '16'], dir)).rejects.toThrow(/Invalid format/);
	});
});

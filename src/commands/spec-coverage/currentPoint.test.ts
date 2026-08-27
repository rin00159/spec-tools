// Resolution of the current point. The source of truth is "Location of the current point" in spec/00-conventions.md.
//
// It is intentional that the clause ID is not placed in the test name (tools/ is not subject to Question 1.
// 00-conventions.md "Scope where leading ID is mandatory" / docs/decisions/026 §3).

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
	it('returns undefined if not specified', () => {
		expect(readPhaseOverride([])).toBeUndefined();
		expect(readPhaseOverride(['--other', 'value'])).toBeUndefined();
	});

	it('returns the value if specified exactly once', () => {
		expect(readPhaseOverride(['--phase', 'v0_1_16'])).toBe('v0_1_16');
	});

	it('throws an error for multiple specifications — does not silently pick one', () => {
		expect(() => readPhaseOverride(['--phase', 'v0_1_16', '--phase', 'v0_1_17'])).toThrow(
			/provided 2 times/,
		);
	});

	it('throws an error if specified without a value', () => {
		expect(() => readPhaseOverride(['--phase'])).toThrow(/Missing value/);
	});
});

describe('readPhaseFile', () => {
	it('reads the token from spec/PHASE (ignores surrounding whitespace)', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await writeFile(join(dir, PHASE_FILE_NAME), '  v0_1_16 \n', 'utf8');
		const point = await readPhaseFile(dir);
		expect(point.major).toBe(0);
		expect(point.minor).toBe(1);
		expect(point.phase).toBe(16);
	});

	it('throws an error for the old format (raw integer)', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await writeFile(join(dir, PHASE_FILE_NAME), '16\n', 'utf8');
		await expect(readPhaseFile(dir)).rejects.toThrow(/Invalid format/);
	});

	it('throws an error if the file does not exist', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await expect(readPhaseFile(dir)).rejects.toThrow(/Failed to read/);
	});
});

describe('resolveCurrentPoint', () => {
	it('uses spec/PHASE if there are no arguments', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await writeFile(join(dir, PHASE_FILE_NAME), 'v0_1_16\n', 'utf8');
		const result = await resolveCurrentPoint([], dir);
		expect(result.point.phase).toBe(16);
		expect(result.overridden).toBe(false);
	});

	it('prioritizes --phase over spec/PHASE', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await writeFile(join(dir, PHASE_FILE_NAME), 'v0_1_16\n', 'utf8');
		const result = await resolveCurrentPoint(['--phase', 'v0_2_1'], dir);
		expect(result.point.minor).toBe(2);
		expect(result.point.phase).toBe(1);
		expect(result.overridden).toBe(true);
	});

	it('throws an error for invalid --phase format', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await expect(resolveCurrentPoint(['--phase', '16'], dir)).rejects.toThrow(/Invalid format/);
	});
});

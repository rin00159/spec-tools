// Parsing and ordering of clause `impl` (plan version + Phase). The source of truth is "`impl` format" in spec/00-conventions.md.
//
// It is intentional that no clause ID is placed in the test name — tools/ is a development tool and has no corresponding clause,
// and borrowing an existing ID would create a fake implementation evidence (00-conventions.md "Scope where leading ID is mandatory" /
// docs/decisions/026 §3). tools/ is not subject to Question 1.

import { describe, expect, it } from 'vitest';
import { compareImplPoint, formatImplPoint, isReached, parseImplPoint } from './implPoint.ts';

describe('parseImplPoint', () => {
	it('decomposes v<major>_<minor>_<phase> into 3 integers', () => {
		expect(parseImplPoint('v0_1_16')).toEqual({
			major: 0,
			minor: 1,
			phase: 16,
		});
		expect(parseImplPoint('v0_2_1')).toEqual({ major: 0, minor: 2, phase: 1 });
		expect(parseImplPoint('v10_0_0')).toEqual({
			major: 10,
			minor: 0,
			phase: 0,
		});
	});

	it.each([
		['v0_1_01', 'leading zeros'],
		['v0_01_1', 'leading zeros (minor)'],
		['0_1_1', 'missing prefix v'],
		['v0_1', 'only 2 components'],
		['v0_1_1_1', '4 components'],
		['v-1_1_1', 'negative values'],
		['v0_1_1.5', 'decimal numbers'],
		['16', 'old format raw integer'],
		['', 'empty string'],
	])('rejects invalid format %s (%s)', (token) => {
		expect(parseImplPoint(token)).toBeUndefined();
	});

	it('formatImplPoint is the inverse of parsing', () => {
		for (const token of ['v0_1_1', 'v0_1_16', 'v0_2_1', 'v10_0_0']) {
			const point = parseImplPoint(token);
			expect(point).toBeDefined();
			if (point === undefined) {
				return;
			}
			expect(formatImplPoint(point)).toBe(token);
		}
	});
});

describe('compareImplPoint', () => {
	function cmp(a: string, b: string): number {
		const pa = parseImplPoint(a);
		const pb = parseImplPoint(b);
		if (pa === undefined || pb === undefined) {
			throw new Error(`Invalid format: ${a} / ${b}`);
		}
		return compareImplPoint(pa, pb);
	}

	it('compares phase as integers — string comparison would yield incorrect results for these combinations', () => {
		// The exact reason why 00-conventions.md prohibits string comparison.
		// As strings, "v0_1_2" > "v0_1_16" and "v0_1_9" > "v0_1_10".
		expect(cmp('v0_1_2', 'v0_1_16')).toBeLessThan(0);
		expect('v0_1_2' > 'v0_1_16').toBe(true);

		expect(cmp('v0_1_9', 'v0_1_10')).toBeLessThan(0);
		expect('v0_1_9' > 'v0_1_10').toBe(true);
	});

	it('compares in order of major → minor → phase', () => {
		expect(cmp('v0_1_16', 'v0_2_1')).toBeLessThan(0);
		expect(cmp('v0_2_1', 'v0_1_16')).toBeGreaterThan(0);
		expect(cmp('v0_9_9', 'v1_0_0')).toBeLessThan(0);
	});

	it('returns 0 for identical points', () => {
		expect(cmp('v0_1_5', 'v0_1_5')).toBe(0);
	});
});

describe('isReached', () => {
	function reached(impl: string, current: string): boolean {
		const a = parseImplPoint(impl);
		const b = parseImplPoint(current);
		if (a === undefined || b === undefined) {
			throw new Error(`Invalid format: ${impl} / ${current}`);
		}
		return isReached(a, b);
	}

	it('considers impl equal to or before the current point as reached', () => {
		expect(reached('v0_1_1', 'v0_1_16')).toBe(true);
		expect(reached('v0_1_16', 'v0_1_16')).toBe(true);
	});

	it('considers future Phases of another version as not reached', () => {
		// When the current point is v0_1_16, clauses of v0.2 are not subject to Question 2.
		expect(reached('v0_2_1', 'v0_1_16')).toBe(false);
	});

	it('considers all Phases of previous versions as reached when the version increases', () => {
		expect(reached('v0_1_16', 'v0_2_1')).toBe(true);
	});
});

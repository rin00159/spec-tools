import { describe, expect, it } from 'vitest';
import {
	acceptanceFileFor,
	acceptanceTemplate,
	decisionTemplate,
	nextNumber,
	numberedFileName,
	planFileFor,
	SLUG_RE,
} from './naming.ts';

const point = { major: 0, minor: 2, phase: 25 };

describe('nextNumber', () => {
	it('returns 200 when only legacy numbers exist (legacy frozen)', () => {
		expect(nextNumber(['001-a.md', '087-b.md', '088-c.md', 'README.md'])).toBe(200);
		expect(nextNumber(['110-last-legacy.md'])).toBe(200);
	});

	it('starts from 200 even in an empty directory', () => {
		expect(nextNumber([])).toBe(200);
		expect(nextNumber(['README.md', 'notes.md'])).toBe(200);
	});

	it('returns the existing maximum number +1 if numbers from 200 onwards exist', () => {
		expect(nextNumber(['200-a.md', '205-b.md'])).toBe(206);
	});
});

describe('numberedFileName', () => {
	it('constructs a file name with a 3-digit zero-padded number and slug', () => {
		expect(numberedFileName(89, 'repo-context-diet')).toBe('089-repo-context-diet.md');
	});
});

describe('SLUG_RE', () => {
	it('only allows lowercase letters, numbers, and hyphens', () => {
		expect(SLUG_RE.test('repo-context-diet')).toBe(true);
		expect(SLUG_RE.test('Repo_Context')).toBe(false);
		expect(SLUG_RE.test('invalid!slug')).toBe(false);
	});
});

describe('path derivation', () => {
	it('acceptance evidence is uniquely determined from the current location', () => {
		expect(acceptanceFileFor(point)).toBe('docs/acceptance/phase-v0_2-25.md');
	});

	it('the source of truth for Phase is phase<N>.md', () => {
		expect(planFileFor(point)).toBe('docs/plan/0_2/phase25.md');
	});
});

describe('template', () => {
	it('decision fills in the number, title, and date', () => {
		const text = decisionTemplate(89, 'Optimize repository information management', '2026-08-19');
		expect(text).toContain('# 089 Optimize repository information management');
		expect(text).toContain('2026-08-19');
	});

	it('acceptance must always have an approval checkbox', () => {
		expect(acceptanceTemplate(point, '2026-08-19')).toContain('- [ ] User approval');
	});

	it('acceptance embeds a link to the source of truth for completion criteria', () => {
		expect(acceptanceTemplate(point, '2026-08-19')).toContain('docs/plan/0_2/phase25.md');
	});
});

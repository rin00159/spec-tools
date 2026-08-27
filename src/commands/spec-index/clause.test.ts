import { describe, expect, it } from 'vitest';
import type { ClauseInfo } from '../spec-coverage/specClauses.ts';
import { extractClauseBody, renderIndex, suggestIds } from './clause.ts';

const lines = [
	'# Heading',
	'',
	'## K-CORE-DEF-001 Monotonic refinement',
	'',
	'**Attributes**: `status: active`',
	'',
	'### Subheading',
	'',
	'Body',
	'',
	'## K-CORE-DEF-002 Next clause',
	'',
	'Next body',
];

function clause(overrides: Partial<ClauseInfo>): ClauseInfo {
	return {
		id: 'K-CORE-DEF-001',
		status: 'active',
		since: '0.1.0',
		kind: 'normative',
		impl: { major: 0, minor: 1, phase: 1 },
		file: 'packages/core/docs/spec/10-core-model.md',
		line: 3,
		title: 'Monotonic refinement',
		isNormative: true,
		isActive: true,
		...overrides,
	};
}

describe('extractClauseBody', () => {
	it('returns the body up to just before the next `## ` heading', () => {
		const body = extractClauseBody(lines, 3);
		expect(body).toContain('## K-CORE-DEF-001 Monotonic refinement');
		expect(body).toContain('Body');
		expect(body).not.toContain('K-CORE-DEF-002');
	});

	it('includes `### ` subheadings in the body (the clause is not cut off halfway)', () => {
		expect(extractClauseBody(lines, 3)).toContain('### Subheading');
	});

	it('uses the remainder of the file as the body for the last clause', () => {
		const body = extractClauseBody(lines, 11);
		expect(body).toContain('Next body');
	});
});

describe('suggestIds', () => {
	it('suggests clauses from the same AREA', () => {
		expect(
			suggestIds(['K-CORE-TYPE', '999'].join('-'), ['K-CORE-TYPE-001', 'K-CORE-DEF-001']),
		).toEqual(['K-CORE-TYPE-001']);
	});

	it('picks up prefix matches if AREA does not match', () => {
		expect(suggestIds(['K-CORE-XXXX', '001'].join('-'), ['K-CORE-TYPE-001'])).toEqual([
			'K-CORE-TYPE-001',
		]);
	});
});

describe('renderIndex', () => {
	it('explicitly states at the top that it is a generated product (C2)', () => {
		expect(renderIndex([clause({})])).toContain('Do not edit manually');
	});

	it('divides by file and orders clauses by line number', () => {
		const output = renderIndex([
			clause({ id: 'K-CORE-DEF-002', line: 40 }),
			clause({ id: 'K-CORE-DEF-001', line: 10 }),
		]);
		expect(output.indexOf('K-CORE-DEF-001')).toBeLessThan(output.indexOf('K-CORE-DEF-002'));
	});

	it('counts the number of withdrawn clauses', () => {
		expect(
			renderIndex([
				clause({}),
				clause({ id: 'K-CORE-DEF-002', status: 'withdrawn', isActive: false }),
			]),
		).toContain('withdrawn/inactive: 1');
	});
});

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSpecClauses } from './specClauses.ts';

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), 'scope-spec-clauses-'));
}

describe('parseSpecClauses', () => {
	it('default settings correctly extract values (positional fallback)', async () => {
		const repo = await createFixtureRepo();
		const specDir = join(repo, 'spec');
		await mkdir(specDir, { recursive: true });
		await writeFile(
			join(specDir, '01-test.md'),
			`
## K-CORE-DEF-001 Test
**Attributes**: \`status: active\` / \`since: 0.1\` / \`kind: normative\` / \`impl: v0_1_1\`
`,
			'utf8',
		);

		const clauses = await parseSpecClauses([specDir], {
			attrPattern:
				'^\\*\\*Attributes\\*\\*: \\`status: (?<status>active|withdrawn)\\` / \\`since: (?<since>[\\d.]+)\\` / \\`kind: (?<kind>normative|informational)\\` / \\`impl: (?<impl>[^`]+)\\`\\s*$',
			normativeKinds: ['normative'],
		});
		expect(clauses.length).toBe(1);
		expect(clauses[0].id).toBe('K-CORE-DEF-001');
		expect(clauses[0].title).toBe('Test');
		expect(clauses[0].status).toBe('active');
		expect(clauses[0].kind).toBe('normative');
		expect(clauses[0].isNormative).toBe(true);
		expect(clauses[0].isActive).toBe(true);
	});

	it('supports named groups and arbitrary string extraction with config', async () => {
		const repo = await createFixtureRepo();
		const specDir = join(repo, 'spec');
		await mkdir(specDir, { recursive: true });
		await writeFile(
			join(specDir, '01-test.md'),
			`
## REQ-001 Test Requirement
**ATTRS**: \`Status: Working\` | \`Since: 1.0\` | \`Type: Req\` | \`Impl: v1_0_0\`
`,
			'utf8',
		);

		const clauses = await parseSpecClauses([specDir], {
			idPattern: 'REQ-\\d{3}',
			headingPattern: '^##\\s+(?<id>REQ-\\d{3})\\s+(?<title>.+)$',
			attrPattern:
				'^\\*\\*ATTRS\\*\\*: \\`Status: (?<status>Working|Done)\\` \\| \\`Since: (?<since>[\\d.]+)\\` \\| \\`Type: (?<kind>Req|Info)\\` \\| \\`Impl: (?<impl>[^`]+)\\`\\s*$',
			normativeKinds: ['Req'],
			activeStatuses: ['Working'],
		});

		expect(clauses.length).toBe(1);
		expect(clauses[0].id).toBe('REQ-001');
		expect(clauses[0].title).toBe('Test Requirement');
		expect(clauses[0].status).toBe('Working');
		expect(clauses[0].kind).toBe('Req');
		expect(clauses[0].isNormative).toBe(true);
		expect(clauses[0].isActive).toBe(true);
	});

	it('computes isNormative and isActive as false when value is not in configured arrays', async () => {
		const repo = await createFixtureRepo();
		const specDir = join(repo, 'spec');
		await mkdir(specDir, { recursive: true });
		await writeFile(
			join(specDir, '01-test.md'),
			`
## K-CORE-DEF-001 Test
**Attributes**: \`status: withdrawn\` / \`since: 0.1\` / \`kind: informational\` / \`impl: v0_1_1\`
`,
			'utf8',
		);

		const clauses = await parseSpecClauses([specDir], {
			attrPattern:
				'^\\*\\*Attributes\\*\\*: \\`status: (?<status>active|withdrawn)\\` / \\`since: (?<since>[\\d.]+)\\` / \\`kind: (?<kind>normative|informational)\\` / \\`impl: (?<impl>[^`]+)\\`\\s*$',
			normativeKinds: ['normative'],
		});
		expect(clauses.length).toBe(1);
		expect(clauses[0].status).toBe('withdrawn');
		expect(clauses[0].kind).toBe('informational');
		expect(clauses[0].isNormative).toBe(false);
		expect(clauses[0].isActive).toBe(false);
	});
});

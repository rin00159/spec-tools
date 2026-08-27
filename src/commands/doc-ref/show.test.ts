// Tests for decisions / task reference resolution.
// The primary source is docs/decisions/109 Decision 4 / docs/plan/0_3/phase5.md Scope 6.
//
// The omission of the clause ID in the test name is intentional (tools/ is out of scope for Question 1).

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDocRef } from './show.ts';

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), 'scope-doc-show-'));
}

describe('resolveDocRef', () => {
	it('resolves legacy bare numbers from root docs/decisions', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');
		const decisionsDir = join(repo, 'docs', 'decisions');
		await mkdir(decisionsDir, { recursive: true });
		await writeFile(
			join(decisionsDir, '105-fch-artifact.md'),
			'# 105 FCH Artifact Shape\n\nBody 105',
			'utf8',
		);

		const resolved = await resolveDocRef(repo, 'decision', '105');
		expect(resolved.content).toContain('# 105 FCH Artifact Shape');
		expect(resolved.reference).toBe('root:105');
	});

	it('throws an error for bare numbers >= 200', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');
		await expect(resolveDocRef(repo, 'decision', '200')).rejects.toThrow(/must be namespaced/);
	});

	it('resolves namespaced references (@scope/pkg:200)', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');
		const pkgDir = join(repo, 'packages', 'schemaui');
		const decisionsDir = join(pkgDir, 'docs', 'decisions');
		await mkdir(decisionsDir, { recursive: true });
		await writeFile(
			join(pkgDir, 'package.json'),
			JSON.stringify({ name: '@scope/schemaui' }),
			'utf8',
		);
		await writeFile(
			join(decisionsDir, '200-new-decision.md'),
			'# 200 New Decision\n\nBody 200',
			'utf8',
		);

		const resolved = await resolveDocRef(repo, 'decision', '@scope/schemaui:200');
		expect(resolved.content).toContain('# 200 New Decision');
		expect(resolved.reference).toBe('@scope/schemaui:200');
	});

	it('resolves and returns the body of the destination for stub files', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');
		const rootDecisionsDir = join(repo, 'docs', 'decisions');
		await mkdir(rootDecisionsDir, { recursive: true });

		const pkgDir = join(repo, 'packages', 'html');
		const pkgDecisionsDir = join(pkgDir, 'docs', 'decisions');
		await mkdir(pkgDecisionsDir, { recursive: true });
		await writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@scope/html' }), 'utf8');
		await writeFile(
			join(pkgDecisionsDir, '105-fch-shape.md'),
			'# 105 FCH Artifact Shape (Entity)\n\nDestination Body',
			'utf8',
		);

		// Place stub at the root
		await writeFile(
			join(rootDecisionsDir, '105-fch-shape.md'),
			`# 105 FCH Artifact Shape\n\n**Moved To**: \`@scope/html:105\`\n`,
			'utf8',
		);

		const resolved = await resolveDocRef(repo, 'decision', '105');
		expect(resolved.content).toContain('Destination Body');
	});
});

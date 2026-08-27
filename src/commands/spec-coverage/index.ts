// spec:coverage — 00-conventions.md が定める3つの問いに答える(K-CORE-ERR-002 の検出源(b)を含む)。
// 実行: `node --experimental-strip-types tools/spec-coverage/src/index.ts`
// 現在地は spec/PHASE。一時的な上書きは `--phase v0_2_1`(複数指定は error)。

import { join, relative } from 'node:path';
import { loadConfig } from '../../config.ts';
import { type CodeClauseRef, scanSourceCodeRefs } from './codeScan.ts';
import { resolveCurrentPoint } from './currentPoint.ts';
import { compareImplPoint, formatImplPoint, type ImplPoint } from './implPoint.ts';
import { type ClauseInfo, DEFAULT_CLAUSE_ID_PATTERN, parseSpecClauses } from './specClauses.ts';
import { discoverSpecRoots } from './specRoots.ts';
import { scanTestNames, type TestNameEntry } from './testScan.ts';

export async function runSpecCoverage(
	repoRoot: string = process.cwd(),
	args: string[],
): Promise<void> {
	const fullConfig = loadConfig(repoRoot);
	const config = fullConfig.specCoverage || {};
	const conformanceRoots = config.conformanceRoots || ['packages', 'examples'];
	const scanRoots = config.scanRoots || ['packages', 'tools', 'examples', 'apps'];
	const sourceExtensions = config.sourceExtensions || [
		'.ts',
		'.tsx',
		'.js',
		'.mjs',
		'.cjs',
		'.json',
	];
	const testSuffixes = config.testSuffixes || ['.test.ts'];
	const testNamePatterns = config.testNamePatterns || [
		'\\b(?:it|test)(?:\\.\\w+)?\\(\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|\'((?:[^\'\\\\]|\\\\.)*)\')',
	];
	const idPattern = fullConfig.clauseFormat?.idPattern ?? DEFAULT_CLAUSE_ID_PATTERN;

	function requiresLeadingId(file: string): boolean {
		return conformanceRoots.some((root) => file === root || file.startsWith(`${root}/`));
	}

	const specRoots = config.specRoots ?? (await discoverSpecRoots(repoRoot));
	const { point: currentPhase, overridden } = await resolveCurrentPoint(
		args,
		join(repoRoot, 'spec'),
	);

	const clauses = (await parseSpecClauses(specRoots, fullConfig.clauseFormat)).map((clause) => ({
		...clause,
		file: relative(repoRoot, clause.file),
	}));
	const testEntries = await scanTestNames(scanRoots, idPattern, testSuffixes, testNamePatterns);
	const knownIds = new Set(clauses.map((c) => c.id));

	const idLessTests = testEntries.filter(
		(entry) => entry.leadingId === undefined && requiresLeadingId(entry.file),
	);

	const unknownRefsInTests = testEntries.flatMap((entry) =>
		entry.referencedIds
			.filter((id) => !knownIds.has(id))
			.map((id) => ({ file: entry.file, name: entry.name, id })),
	);

	const codeScanResult = await scanSourceCodeRefs(scanRoots, knownIds, idPattern, sourceExtensions);
	const unknownRefsInSource = codeScanResult.unknownRefs.filter(
		(ref) => !unknownRefsInTests.some((t) => t.file === ref.file && t.id === ref.id),
	);

	const evidencedIds = new Set<string>();
	for (const entry of testEntries) {
		for (const id of entry.referencedIds) {
			evidencedIds.add(id);
		}
	}
	for (const ref of codeScanResult.knownRefs) {
		evidencedIds.add(ref.id);
	}

	const uncoveredClauses = clauses.filter(
		(clause) =>
			clause.kind === '規範' &&
			clause.status === 'active' &&
			compareImplPoint(clause.impl, currentPhase) <= 0 &&
			!evidencedIds.has(clause.id),
	);

	const aheadClauses = clauses.filter(
		(clause) => clause.status === 'active' && compareImplPoint(clause.impl, currentPhase) > 0,
	);

	report({
		currentPhase,
		overridden,
		aheadClauses,
		idLessTests,
		uncoveredClauses,
		unknownRefsInTests,
		unknownRefsInSource,
		todoRefs: codeScanResult.todoRefs,
	});

	const ok =
		idLessTests.length === 0 &&
		uncoveredClauses.length === 0 &&
		unknownRefsInTests.length === 0 &&
		unknownRefsInSource.length === 0;
	process.exitCode = ok ? 0 : 1;
}

function report(input: {
	readonly currentPhase: ImplPoint;
	readonly overridden: boolean;
	readonly aheadClauses: readonly ClauseInfo[];
	readonly idLessTests: readonly TestNameEntry[];
	readonly uncoveredClauses: readonly ClauseInfo[];
	readonly unknownRefsInTests: readonly { file: string; name: string; id: string }[];
	readonly unknownRefsInSource: readonly CodeClauseRef[];
	readonly todoRefs: readonly CodeClauseRef[];
}): void {
	const current = formatImplPoint(input.currentPhase);
	const source = input.overridden ? '--phase flag' : 'spec/PHASE';
	console.log(`spec:coverage (${current} reached / source: ${source})`);

	if (input.aheadClauses.length > 0) {
		const max = input.aheadClauses.reduce((a, b) =>
			compareImplPoint(a.impl, b.impl) >= 0 ? a : b,
		);
		console.log(
			`\nNote: Clauses with impl point ahead of current — ${input.aheadClauses.length} items ` +
				`(max ${formatImplPoint(max.impl)}). Not target of Question 2. ` +
				`If not intentional early writing, update spec/PHASE.`,
		);
	}

	if (input.todoRefs.length > 0) {
		console.log(
			`\nNote: TODO(K-...) deferred clause references — ${input.todoRefs.length} items. Not target of Question 3. Must be 0 at acceptance.`,
		);
		for (const ref of input.todoRefs) {
			console.log(`  - ${ref.file}:${ref.line}: TODO(${ref.id})`);
		}
	}

	console.log(`\nQuestion 1: Tests without clause IDs — ${input.idLessTests.length} items`);
	for (const entry of input.idLessTests) {
		console.log(`  - ${entry.file}: "${entry.name}"`);
	}

	console.log(
		`\nQuestion 2: Clauses with no implementation or test (impl<=${current}) — ${input.uncoveredClauses.length} items`,
	);
	for (const clause of input.uncoveredClauses) {
		console.log(`  - ${clause.id} (${clause.file}, impl: ${formatImplPoint(clause.impl)})`);
	}

	const totalUnknown = input.unknownRefsInTests.length + input.unknownRefsInSource.length;
	console.log(`\nQuestion 3: References to non-existent clause IDs — ${totalUnknown} items`);
	for (const ref of input.unknownRefsInTests) {
		console.log(`  - Test "${ref.name}" (${ref.file}) references unknown ${ref.id}`);
	}
	for (const ref of input.unknownRefsInSource) {
		console.log(`  - Source ${ref.file}:${ref.line} references unknown ${ref.id}`);
	}
}

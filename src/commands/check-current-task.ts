import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config.ts';

export interface CardViolation {
	kind: 'tooLong' | 'missingHeading';
	detail: string;
}

export function checkCard(
	text: string,
	maxLines: number,
	requiredHeadings: string[],
): CardViolation[] {
	const violations: CardViolation[] = [];
	const lines = text.replace(/\s+$/, '').split('\n');

	if (lines.length > maxLines) {
		violations.push({
			kind: 'tooLong',
			detail: `${lines.length} lines (max ${maxLines}).`,
		});
	}

	for (const heading of requiredHeadings) {
		if (!lines.some((line) => line.startsWith(heading))) {
			violations.push({
				kind: 'missingHeading',
				detail: `Missing required heading: ${heading}`,
			});
		}
	}

	return violations;
}

export function runCheckCurrentTask(cwd: string = process.cwd()): void {
	const config = loadConfig(cwd).checkCurrentTask || {};
	const file = config.file || 'docs/currentTask.ai.md';
	const maxLines = config.maxLines || 80;
	// 汎用ツールとしてのデフォルト値（英語）
	const headings = config.headings || ['## Current Status', '## Next Steps', '## Blockers'];

	const cardPath = resolve(cwd, file);
	if (!existsSync(cardPath)) {
		console.error(`check-current-task: File not found: ${file}`);
		process.exitCode = 1;
		return;
	}

	const text = readFileSync(cardPath, 'utf8');
	const violations = checkCard(text, maxLines, headings);

	if (violations.length > 0) {
		console.error(`check-current-task: Invalid format in ${file}`);
		for (const violation of violations) {
			console.error(`  - ${violation.detail}`);
		}
		process.exitCode = 1;
		return;
	}

	console.log(`check-current-task: Format is valid (${file}, max ${maxLines} lines)`);
}

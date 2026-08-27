import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface ClauseFormatConfig {
	/** Regex string for matching a clause ID in plain text */
	idPattern?: string;
	/** Regex string with named capture groups `id` and `title` */
	headingPattern?: string;
	/** Regex string with named capture groups `status`, `since`, `kind`, and `impl` */
	attrPattern?: string;
}

export interface SpecToolsConfig {
	checkCurrentTask?: {
		file?: string;
		maxLines?: number;
		headings?: string[];
	};
	checkPlanLayout?: {
		planDir?: string;
		scanRoots?: string[];
		rootFiles?: string[];
	};
	checkMirror?: {
		mirrorRoots?: [string, string];
		mirroredSubtrees?: string[];
		mirroredFilePairs?: [string, string][];
	};
	specCoverage?: {
		specRoots?: string[];
		conformanceRoots?: string[];
		scanRoots?: string[];
	};
	clauseFormat?: ClauseFormatConfig;
}

export function loadConfig(cwd: string = process.cwd()): SpecToolsConfig {
	let current = cwd;
	while (true) {
		const configPath = join(current, 'spec-tools.config.json');
		if (existsSync(configPath)) {
			try {
				const content = readFileSync(configPath, 'utf8');
				return JSON.parse(content) as SpecToolsConfig;
			} catch (e) {
				console.error(
					`Failed to parse config at ${configPath}: ${e instanceof Error ? e.message : String(e)}`,
				);
				process.exit(1);
			}
		}
		const parent = dirname(current);
		if (parent === current) {
			break;
		}
		current = parent;
	}
	return {};
}

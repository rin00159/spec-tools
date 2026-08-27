import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
		conformanceRoots?: string[];
		scanRoots?: string[];
	};
}

export function loadConfig(cwd: string = process.cwd()): SpecToolsConfig {
	const configPath = join(cwd, 'spec-tools.config.json');
	if (existsSync(configPath)) {
		try {
			const content = readFileSync(configPath, 'utf8');
			return JSON.parse(content) as SpecToolsConfig;
		} catch (e) {
			console.error(`Failed to parse config at ${configPath}`, e);
			return {};
		}
	}
	return {};
}

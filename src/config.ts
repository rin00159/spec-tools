import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface ClauseFormatConfig {
	/** Regex string for matching a clause ID in plain text */
	idPattern?: string;
	/** Regex string with named capture groups `id` and `title` */
	headingPattern?: string;
	/** Regex string with named capture groups `status`, `since`, `kind`, and `impl` */
	attrPattern?: string;
	/** Values of `kind` that are considered normative */
	normativeKinds?: string[];
	/** Values of `status` that are considered active */
	activeStatuses?: string[];
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
		/** 走査対象とするソースコードの拡張子 (例: ['.ts', '.tsx', '.py', '.go']) */
		sourceExtensions?: string[];
		/** テストファイルとみなす接尾辞 (例: ['.test.ts', '_test.py', '_test.go']) */
		testSuffixes?: string[];
		/** テスト名抽出用の正規表現文字列。キャプチャグループ1（または最初の有効なグループ）がテスト名になること。 */
		testNamePatterns?: string[];
	};
	docRef?: {
		decisionDir?: string;
		taskDir?: string;
		namespacePattern?: string;
		historicalPrefixes?: string[];
	};
	scaffold?: {
		/** Directory containing custom markdown templates (decision.md, task.md, acceptance.md) */
		templateDir?: string;
		/** The starting number for new decisions/tasks (defaults to 200 to freeze 1-199 for legacy) */
		startNumber?: number;
	};
	specIndex?: {
		/** Custom header text or file path for the generated INDEX.md */
		header?: string;
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

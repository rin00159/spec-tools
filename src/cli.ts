#!/usr/bin/env node
import { parseArgs } from 'node:util';

let positionals: string[] = [];
let values: {
	help?: boolean;
	package?: string;
	check?: boolean;
} = {};

try {
	const parsed = parseArgs({
		args: process.argv.slice(2),
		options: {
			help: { type: 'boolean', short: 'h' },
			package: { type: 'string' },
			check: { type: 'boolean' },
		},
		allowPositionals: true,
		strict: false,
	});
	positionals = parsed.positionals;
	values = parsed.values as {
		help?: boolean;
		package?: string;
		check?: boolean;
	};
} catch (e) {
	console.error(e instanceof Error ? e.message : String(e));
	process.exit(1);
}

if (values.help || positionals.length === 0) {
	console.log(`
spec-tools - Spec-driven project management and AI collaboration tools

Usage:
  spec-tools <command> [options]

Commands:
  check-current-task     Check current task status
  check-plan-layout      Check the layout of docs/plan directory
  check-mirror           Check CLAUDE.md/AGENTS.md mirror 
  doc-ref show           Show a document reference
  doc-ref list           List document references
  doc-ref index          Generate index for document references
  doc-ref check          Check all document references in the repository
  spec-index             Generate spec index
  spec-show              Show a specific spec clause
  spec-coverage          Check spec coverage
  scaffold               Scaffold a new decision or task

Options:
  --package <pkg>        Specify package name (for scaffold, doc-ref list)
  --check                Run in check-only mode (for spec-index, doc-ref index)
`);
	process.exit(0);
}

const [command, ...args] = positionals;

async function main() {
	try {
		switch (command) {
			case 'check-current-task': {
				const { runCheckCurrentTask } = await import('./commands/check-current-task.ts');
				runCheckCurrentTask(process.cwd());
				break;
			}
			case 'check-plan-layout': {
				const { runCheckPlanLayout } = await import('./commands/check-plan-layout.ts');
				runCheckPlanLayout(process.cwd());
				break;
			}
			case 'check-mirror': {
				const { runCheckMirror } = await import('./commands/check-mirror.ts');
				await runCheckMirror(process.cwd());
				break;
			}
			case 'doc-ref': {
				const subCommand = args[0];
				if (subCommand === 'show') {
					const { runShow } = await import('./commands/doc-ref/show.ts');
					await runShow(process.cwd(), args[1], args.slice(2));
				} else if (subCommand === 'list') {
					const { runList } = await import('./commands/doc-ref/list.ts');
					await runList(process.cwd(), args[1], values.package);
				} else if (subCommand === 'index') {
					const { runIndexGen } = await import('./commands/doc-ref/indexGen.ts');
					await runIndexGen(process.cwd(), args[1], values.check || false);
				} else if (subCommand === 'check') {
					const { validateDocRefsInRepo } = await import('./commands/doc-ref/refScan.ts');
					const { loadConfig } = await import('./config.ts');
					const fullConfig = loadConfig(process.cwd());
					const { violations } = await validateDocRefsInRepo(process.cwd(), {
						scanRoots: fullConfig.specCoverage?.scanRoots,
						historicalPrefixes: fullConfig.docRef?.historicalPrefixes,
						decisionDir: fullConfig.docRef?.decisionDir,
						taskDir: fullConfig.docRef?.taskDir,
						namespacePattern: fullConfig.docRef?.namespacePattern,
						examplePatterns: fullConfig.docRef?.examplePatterns,
					});
					for (const v of violations) console.error(v);
					if (violations.length > 0) process.exit(1);
					console.log('doc-ref check: 0 violations');
				} else {
					console.error(`Unknown doc-ref sub-command: ${subCommand}`);
					process.exit(1);
				}
				break;
			}
			case 'spec-index': {
				const { runSpecIndex } = await import('./commands/spec-index/index.ts');
				await runSpecIndex(process.cwd(), values.check || false);
				break;
			}
			case 'spec-show': {
				const { runSpecShow } = await import('./commands/spec-index/show.ts');
				await runSpecShow(process.cwd(), args);
				break;
			}
			case 'spec-coverage': {
				const { runSpecCoverage } = await import('./commands/spec-coverage/index.ts');
				await runSpecCoverage(process.cwd(), process.argv.slice(2));
				break;
			}
			case 'scaffold': {
				const { runScaffold } = await import('./commands/scaffold/index.ts');
				await runScaffold(process.cwd(), args, values.package);
				break;
			}
			default:
				console.error(`Unknown command: ${command}`);
				process.exit(1);
		}
	} catch (e) {
		console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
		process.exit(1);
	}
}

main();

#!/usr/bin/env node
import { parseArgs } from 'node:util';

const { positionals, values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		help: { type: 'boolean', short: 'h' },
	},
	allowPositionals: true,
	strict: false,
});

if (values.help || positionals.length === 0) {
	console.log(`
spec-tools - Spec-driven project management and AI collaboration tools

Usage:
  spec-tools <command> [options]

Commands:
  (Commands will be migrated here)
`);
	process.exit(0);
}

const [command, ...args] = positionals;

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
			const pkgIndex = process.argv.indexOf('--package');
			const filter = pkgIndex !== -1 ? process.argv[pkgIndex + 1] : undefined;
			await runList(process.cwd(), args[1], filter);
		} else if (subCommand === 'index') {
			const { runIndexGen } = await import('./commands/doc-ref/indexGen.ts');
			const checkOnly = process.argv.includes('--check');
			await runIndexGen(process.cwd(), args[1], checkOnly);
		} else {
			console.error(`Unknown doc-ref sub-command: ${subCommand}`);
			process.exit(1);
		}
		break;
	}
	case 'spec-index': {
		const { runSpecIndex } = await import('./commands/spec-index/index.ts');
		const checkOnly = process.argv.includes('--check');
		await runSpecIndex(process.cwd(), checkOnly);
		break;
	}
	case 'spec-show': {
		const { runSpecShow } = await import('./commands/spec-index/show.ts');
		await runSpecShow(process.cwd(), args);
		break;
	}
	case 'spec-coverage': {
		const { runSpecCoverage } = await import('./commands/spec-coverage/index.ts');
		await runSpecCoverage(process.cwd(), args);
		break;
	}
	case 'scaffold': {
		const { runScaffold } = await import('./commands/scaffold/index.ts');
		await runScaffold(process.cwd(), args);
		break;
	}
	default:
		console.error(`Unknown command: ${command}`);
		process.exit(1);
}

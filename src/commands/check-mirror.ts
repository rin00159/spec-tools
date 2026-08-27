import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { loadConfig } from "../config.ts";

type NewerSide = "A" | "B" | "bothModified" | "unknown";

function getGitInfo(filePath: string, cwd: string) {
	try {
		const statusOut = execFileSync("git", ["status", "--porcelain", "--", filePath], {
			cwd,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "ignore"],
		}).trim();
		const isDirty = statusOut.length > 0 && !statusOut.startsWith("??");
		const isUntracked = statusOut.startsWith("??");

		const logOut = execFileSync("git", ["log", "-1", "--format=%cI", "--", filePath], {
			cwd,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "ignore"],
		}).trim();
		const commitDate = logOut.length > 0 ? logOut : null;

		return { commitDate, isDirty, isUntracked };
	} catch {
		return null;
	}
}

function inferNewerSide(pathA: string, pathB: string, cwd: string): NewerSide {
	const infoA = getGitInfo(pathA, cwd);
	const infoB = getGitInfo(pathB, cwd);
	if (!infoA || !infoB) return "unknown";

	const aModified = infoA.isDirty || infoA.isUntracked;
	const bModified = infoB.isDirty || infoB.isUntracked;

	if (aModified && !bModified) return "A";
	if (!aModified && bModified) return "B";
	if (aModified && bModified) return "bothModified";

	if (infoA.commitDate && infoB.commitDate) {
		const timeA = new Date(infoA.commitDate).getTime();
		const timeB = new Date(infoB.commitDate).getTime();
		if (timeA > timeB) return "A";
		if (timeB > timeA) return "B";
	}
	return "unknown";
}

export type MirrorViolation =
	| { kind: "onlyIn"; relativePath: string; presentIn: string; missingIn: string }
	| { kind: "differs"; relativePath: string; rootA: string; rootB: string };

async function listMirrorFiles(rootDir: string, subtrees: string[]): Promise<Map<string, Buffer>> {
	const result = new Map<string, Buffer>();
	for (const subtree of subtrees) {
		const subtreePath = join(rootDir, subtree);
		await walk(subtreePath, subtreePath, subtree, result);
	}
	return result;
}

async function walk(dirPath: string, subtreeRoot: string, subtreePrefix: string, result: Map<string, Buffer>) {
	let entries;
	try {
		entries = await readdir(dirPath, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		const fullPath = join(dirPath, entry.name);
		if (entry.isDirectory()) {
			await walk(fullPath, subtreeRoot, subtreePrefix, result);
		} else if (entry.isFile()) {
			const content = await readFile(fullPath);
			result.set(join(subtreePrefix, relative(subtreeRoot, fullPath)), content);
		}
	}
}

export async function runCheckMirror(cwd: string = process.cwd()): Promise<void> {
	const config = loadConfig(cwd).checkMirror || {};
	const roots = config.mirrorRoots || [".claude", ".agents"];
	const subtrees = config.mirroredSubtrees || ["skills"];
	const filePairs = config.mirroredFilePairs || [["CLAUDE.md", "AGENTS.md"]];

	const [rootAName, rootBName] = roots;
	const rootA = join(cwd, rootAName);
	const rootB = join(cwd, rootBName);

	const filesA = await listMirrorFiles(rootA, subtrees);
	const filesB = await listMirrorFiles(rootB, subtrees);
	const violations: MirrorViolation[] = [];

	const allKeys = new Set([...filesA.keys(), ...filesB.keys()]);
	for (const key of Array.from(allKeys).sort()) {
		const bufA = filesA.get(key);
		const bufB = filesB.get(key);
		if (bufA && !bufB) violations.push({ kind: "onlyIn", relativePath: key, presentIn: rootAName, missingIn: rootBName });
		else if (!bufA && bufB) violations.push({ kind: "onlyIn", relativePath: key, presentIn: rootBName, missingIn: rootAName });
		else if (bufA && bufB && !bufA.equals(bufB)) violations.push({ kind: "differs", relativePath: key, rootA: rootAName, rootB: rootBName });
	}

	for (const [nameA, nameB] of filePairs) {
		const pathA = join(cwd, nameA);
		const pathB = join(cwd, nameB);
		const bufA = existsSync(pathA) ? await readFile(pathA) : undefined;
		const bufB = existsSync(pathB) ? await readFile(pathB) : undefined;
		if (!bufA && !bufB) continue;
		if (bufA && !bufB) violations.push({ kind: "onlyIn", relativePath: "", presentIn: nameA, missingIn: nameB });
		else if (!bufA && bufB) violations.push({ kind: "onlyIn", relativePath: "", presentIn: nameB, missingIn: nameA });
		else if (bufA && bufB && !bufA.equals(bufB)) violations.push({ kind: "differs", relativePath: "", rootA: nameA, rootB: nameB });
	}

	if (violations.length > 0) {
		console.error("check-mirror: Mirrors are out of sync.");
		const onlyInList = violations.filter((v) => v.kind === "onlyIn");
		const differsList = violations.filter((v) => v.kind === "differs");

		if (onlyInList.length > 0) {
			console.error("\n[Missing files]");
			for (const v of onlyInList) {
				if (v.kind !== "onlyIn") continue;
				const present = join(cwd, v.presentIn, v.relativePath);
				const missing = join(cwd, v.missingIn, v.relativePath);
				console.error(`  - ${v.relativePath || v.presentIn}: Only in ${v.presentIn}`);
				console.error(`    To fix: cp ${relative(cwd, present)} ${relative(cwd, missing)}`);
			}
		}

		if (differsList.length > 0) {
			console.error("\n[Different contents]");
			for (const v of differsList) {
				if (v.kind !== "differs") continue;
				const pathA = join(cwd, v.rootA, v.relativePath);
				const pathB = join(cwd, v.rootB, v.relativePath);
				const newer = inferNewerSide(pathA, pathB, cwd);

				let hint = "";
				let recovery = `cp ${relative(cwd, pathA)} ${relative(cwd, pathB)} or vice versa`;
				if (newer === "A") { hint = ` (A is newer)`; recovery = `cp ${relative(cwd, pathA)} ${relative(cwd, pathB)}`; }
				else if (newer === "B") { hint = ` (B is newer)`; recovery = `cp ${relative(cwd, pathB)} ${relative(cwd, pathA)}`; }
				else if (newer === "bothModified") { hint = " (both modified)"; }

				console.error(`  - ${v.relativePath || v.rootA}${hint}`);
				console.error(`    To fix: ${recovery}`);
			}
		}
		process.exitCode = 1;
		return;
	}

	let skillCount = 0;
	if (existsSync(join(rootA, "skills"))) skillCount = readdirSync(join(rootA, "skills")).length;

	console.log(`check-mirror: 0 violations (${skillCount} sub-items, ${filePairs.length} root pairs)`);
}

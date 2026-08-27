// decisions / task 参照実在検査のテスト。
// 正本は docs/decisions/109 決定4・決定8 / kata2:200 / docs/plan/0_3/phase7.md 完了判定5。
//
// テスト名に条項 ID を置いていないのは意図的(tools/ は問い1 の対象外)。

import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	extractDocRefs,
	HISTORICAL_PREFIXES,
	validateDocRefsInRepo,
	walkMarkdownFiles,
} from "./refScan.ts";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), "kata2-ref-scan-"));
}

describe("extractDocRefs", () => {
	it("legacy と名前空間付きの参照を両方抽出する", () => {
		const text = `
# Some Title
参照: docs/decisions/035 および decisions/086
task: docs/task/018
新書式: @kata2/targetlib-firebase:100 と @kata2/targetlib-react:200
ルート: kata2:200
重複: docs/decisions/035
`;
		const refs = extractDocRefs(text);
		expect(refs).toEqual([
			{ raw: "docs/decisions/035", type: "decision", ref: "035", line: 3 },
			{ raw: "decisions/086", type: "decision", ref: "086", line: 3 },
			{ raw: "docs/task/018", type: "task", ref: "018", line: 4 },
			{
				raw: "@kata2/targetlib-firebase:100",
				type: "namespaced",
				ref: "@kata2/targetlib-firebase:100",
				line: 5,
			},
			{
				raw: "@kata2/targetlib-react:200",
				type: "namespaced",
				ref: "@kata2/targetlib-react:200",
				line: 5,
			},
			{ raw: "kata2:200", type: "namespaced", ref: "kata2:200", line: 6 },
		]);
	});
});

describe("validateDocRefsInRepo (fixture)", () => {
	it("走査対象ファイルが0件の場合は空振りとして throw する", async () => {
		const repo = await createFixtureRepo();
		await expect(
			validateDocRefsInRepo(repo, { scanRoots: ["docs"], rootFiles: [] }),
		).rejects.toThrow(/走査対象の markdown ファイルが0件/);
	});

	it("走査された参照が0件の場合は空振りとして throw する", async () => {
		const repo = await createFixtureRepo();
		const docsDir = join(repo, "docs");
		await mkdir(docsDir, { recursive: true });
		await writeFile(join(docsDir, "test.md"), "# No References here\n", "utf8");

		await expect(
			validateDocRefsInRepo(repo, { scanRoots: ["docs"], rootFiles: [] }),
		).rejects.toThrow(/走査された参照が0件/);
	});

	it("存在しない legacy 参照と namespaced 参照を violation として報告する", async () => {
		const repo = await createFixtureRepo();
		await writeFile(
			join(repo, "package.json"),
			JSON.stringify({ name: "kata2" }),
			"utf8",
		);
		const docsDir = join(repo, "docs");
		await mkdir(join(docsDir, "decisions"), { recursive: true });
		await writeFile(
			join(docsDir, "decisions", "001-initial.md"),
			"# 001 Initial\n",
			"utf8",
		);

		await mkdir(join(docsDir, "task"), { recursive: true });
		await writeFile(
			join(docsDir, "task", "018-moved.md"),
			"# 018 Moved\n\n本文は移設先に在る(fixture では参照を書かない)。\n",
			"utf8",
		);

		await writeFile(
			join(docsDir, "test.md"),
			`
# Test Doc
実在する: docs/decisions/001
存在しない legacy: docs/decisions/999
stub で実在する task: docs/task/018
存在しない task: docs/task/998
存在しない名前空間: @kata2/unknown:200
`,
			"utf8",
		);

		const result = await validateDocRefsInRepo(repo, {
			scanRoots: ["docs"],
			rootFiles: [],
		});
		expect(result.totalRefs).toBe(5);
		expect(result.violations.length).toBe(3);
		expect(result.violations[0]).toContain("999");
		expect(result.violations[1]).toContain("docs/task/998");
		expect(result.violations[2]).toContain("@kata2/unknown:200");
	});

	it("正常な参照のみの場合は violations が空になる", async () => {
		const repo = await createFixtureRepo();
		await writeFile(
			join(repo, "package.json"),
			JSON.stringify({ name: "kata2" }),
			"utf8",
		);
		const docsDir = join(repo, "docs");
		await mkdir(join(docsDir, "decisions"), { recursive: true });
		await writeFile(
			join(docsDir, "decisions", "001-initial.md"),
			"# 001 Initial\n",
			"utf8",
		);

		const pkgDir = join(repo, "packages", "core");
		await mkdir(join(pkgDir, "docs", "decisions"), { recursive: true });
		await writeFile(
			join(pkgDir, "package.json"),
			JSON.stringify({ name: "@kata2/core" }),
			"utf8",
		);
		await writeFile(
			join(pkgDir, "docs", "decisions", "200-core-rule.md"),
			"# 200 Core Rule\n",
			"utf8",
		);

		await writeFile(
			join(docsDir, "test.md"),
			`
# Test Doc
実在 legacy: docs/decisions/001
実在 namespaced: @kata2/core:200
`,
			"utf8",
		);

		const result = await validateDocRefsInRepo(repo, {
			scanRoots: ["docs"],
			rootFiles: [],
		});
		expect(result.totalRefs).toBe(2);
		expect(result.violations).toEqual([]);
	});
});

describe("validateDocRefsInRepo (production kata2 repository)", () => {
	it("リポジトリ全体のすべての decisions / task 参照が壊れていないこと (完了判定5)", async () => {
		const result = await validateDocRefsInRepo(REPO_ROOT);
		expect(result.totalFiles).toBeGreaterThan(50);
		expect(result.totalRefs).toBeGreaterThan(100);
		expect(result.violations).toEqual([]);
	});

	it("docs/task/<NNN> 形式の参照が実際に走査されている (空振り防止。v0.3 Phase 8 完了判定4)", async () => {
		const taskRefFiles = walkMarkdownFiles(join(REPO_ROOT, "docs")).filter(
			(f) =>
				!HISTORICAL_PREFIXES.some((p) => relative(REPO_ROOT, f).startsWith(p)),
		);
		let taskRefs = 0;
		for (const file of taskRefFiles) {
			taskRefs += extractDocRefs(readFileSync(file, "utf8")).filter(
				(r) => r.type === "task",
			).length;
		}
		expect(taskRefs).toBeGreaterThan(20);
	});
});

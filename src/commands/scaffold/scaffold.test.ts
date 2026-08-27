// scaffold の --package 指定と採番のテスト。
// 正本は docs/decisions/109 決定4 / docs/plan/0_3/phase5.md 完了判定11。
//
// テスト名に条項 ID を置いていないのは意図的(tools/ は問い1 の対象外)。

import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nextNumber, numberedFileName } from "./naming.ts";

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), "kata2-scaffold-test-"));
}

describe("scaffold --package 採番", () => {
	it("新規 package の decisions ディレクトリは 200 から始まる", async () => {
		const repo = await createFixtureRepo();
		const pkgDir = join(repo, "packages", "core", "docs", "decisions");
		await mkdir(pkgDir, { recursive: true });

		const entries = await readdir(pkgDir);
		const num = nextNumber(entries);
		expect(num).toBe(200);

		const fileName = numberedFileName(num, "sample-decision");
		expect(fileName).toBe("200-sample-decision.md");
	});

	it("既存の決定 (200) がある package では 201 が採番される", async () => {
		const repo = await createFixtureRepo();
		const pkgDir = join(repo, "packages", "schemaui", "docs", "decisions");
		await mkdir(pkgDir, { recursive: true });
		await writeFile(join(pkgDir, "200-initial.md"), "# 200", "utf8");

		const entries = await readdir(pkgDir);
		const num = nextNumber(entries);
		expect(num).toBe(201);
	});

	it("root (kata2) の decisions は legacy 110 の次として 200 が採番される", async () => {
		const entries = ["001-first.md", "110-last-legacy.md", "README.md"];
		const num = nextNumber(entries);
		expect(num).toBe(200);
	});

	it("root (kata2) の task は legacy 063 の次として 200 が採番される", async () => {
		const entries = ["001-first.md", "063-last-legacy.md", "README.md"];
		const num = nextNumber(entries);
		expect(num).toBe(200);
	});
});

// 条項ファイルの走査ルート発見とパースの検査。
// 正本は spec/00-conventions.md「条項ファイルの置き場と走査ルート」。
//
// テスト名に条項 ID を置いていないのは意図的(tools/ は問い1 の対象外。
// 00-conventions.md「先頭 ID が必須になる範囲」)。

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpecClauses } from "./specClauses.ts";
import { discoverSpecRoots } from "./specRoots.ts";

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), "kata2-spec-roots-"));
}

const VALID_ATTR_LINE =
	"**属性**: `status: active` / `since: 0.1.0` / `kind: 規範` / `impl: v0_1_1`";

describe("discoverSpecRoots (T1〜T4)", () => {
	it("T1: spec/ と packages/a/docs/spec と packages/b/docs/spec を持つ fixture は3ルートを昇順で返す", async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, "spec");
		const pkgASpec = join(repo, "packages", "a", "docs", "spec");
		const pkgBSpec = join(repo, "packages", "b", "docs", "spec");

		await mkdir(rootSpec, { recursive: true });
		await mkdir(pkgASpec, { recursive: true });
		await mkdir(pkgBSpec, { recursive: true });

		const expected = [pkgASpec, pkgBSpec, rootSpec].sort();
		const actual = await discoverSpecRoots(repo);
		expect(actual).toEqual(expected);
	});

	it("T2: T1 の fixture に packages/c/docs/spec を足すだけで検査側を変えずに4ルートになる", async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, "spec");
		const pkgASpec = join(repo, "packages", "a", "docs", "spec");
		const pkgBSpec = join(repo, "packages", "b", "docs", "spec");
		const pkgCSpec = join(repo, "packages", "c", "docs", "spec");

		await mkdir(rootSpec, { recursive: true });
		await mkdir(pkgASpec, { recursive: true });
		await mkdir(pkgBSpec, { recursive: true });
		await mkdir(pkgCSpec, { recursive: true });

		const expected = [pkgASpec, pkgBSpec, pkgCSpec, rootSpec].sort();
		const actual = await discoverSpecRoots(repo);
		expect(actual).toEqual(expected);
	});

	it("T3: packages/x/spec (docs 抜き) や packages/x/docs/spec.md (ファイル) は拾わない", async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, "spec");
		const invalidPkg1 = join(repo, "packages", "x", "spec");
		const invalidPkg2Docs = join(repo, "packages", "y", "docs");
		const invalidPkg2File = join(invalidPkg2Docs, "spec.md");

		await mkdir(rootSpec, { recursive: true });
		await mkdir(invalidPkg1, { recursive: true });
		await mkdir(invalidPkg2Docs, { recursive: true });
		await writeFile(invalidPkg2File, "# not a dir", "utf8");

		const actual = await discoverSpecRoots(repo);
		expect(actual).toEqual([rootSpec]);
	});

	it("T4: ルートを1つも持たない fixture は throw する(空振り防止)", async () => {
		const repo = await createFixtureRepo();
		await expect(discoverSpecRoots(repo)).rejects.toThrow(/0件/);
	});
});

describe("parseSpecClauses (T5〜T7)", () => {
	it("T5: ルートはあるが条項が0件の fixture は throw する", async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, "spec");
		await mkdir(rootSpec, { recursive: true });
		await writeFile(join(rootSpec, "README.md"), "# no clauses here", "utf8");

		await expect(parseSpecClauses([rootSpec])).rejects.toThrow(/0件/);
	});

	it("T6: 別ルートの2ファイルが同じ条項 ID を見出しにする fixture は throw し、両方のファイルパスがメッセージに出る", async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, "spec");
		const pkgSpec = join(repo, "packages", "a", "docs", "spec");
		await mkdir(rootSpec, { recursive: true });
		await mkdir(pkgSpec, { recursive: true });

		const file1 = join(rootSpec, "10-model.md");
		const file2 = join(pkgSpec, "10-model.md");

		await writeFile(
			file1,
			`## K-CORE-MODEL-001 Entity\n\n${VALID_ATTR_LINE}\n\n本文1`,
			"utf8",
		);
		await writeFile(
			file2,
			`## K-CORE-MODEL-001 Entity\n\n${VALID_ATTR_LINE}\n\n本文2`,
			"utf8",
		);

		await expect(parseSpecClauses([rootSpec, pkgSpec])).rejects.toThrowError(
			new RegExp(
				`K-CORE-MODEL-001.*${file1}.*${file2}|K-CORE-MODEL-001.*${file2}.*${file1}`,
			),
		);
	});

	it("T7: 同一ルート内の重複は引き続き throw する(回帰)", async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, "spec");
		await mkdir(rootSpec, { recursive: true });

		const file1 = join(rootSpec, "a.md");
		const file2 = join(rootSpec, "b.md");

		await writeFile(
			file1,
			`## K-CORE-MODEL-001 Entity\n\n${VALID_ATTR_LINE}\n\n本文1`,
			"utf8",
		);
		await writeFile(
			file2,
			`## K-CORE-MODEL-001 Duplicate\n\n${VALID_ATTR_LINE}\n\n本文2`,
			"utf8",
		);

		await expect(parseSpecClauses([rootSpec])).rejects.toThrow(
			/K-CORE-MODEL-001/,
		);
	});
});

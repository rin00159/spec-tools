import { describe, expect, it } from "vitest";
import {
	acceptanceFileFor,
	acceptanceTemplate,
	decisionTemplate,
	nextNumber,
	numberedFileName,
	planFileFor,
	SLUG_RE,
} from "./naming.ts";

const point = { major: 0, minor: 2, phase: 25 };

describe("nextNumber", () => {
	it("legacy 番号のみの場合は 200 を返す (legacy 凍結)", () => {
		expect(nextNumber(["001-a.md", "087-b.md", "088-c.md", "README.md"])).toBe(
			200,
		);
		expect(nextNumber(["110-last-legacy.md"])).toBe(200);
	});

	it("空のディレクトリでも 200 から始まる", () => {
		expect(nextNumber([])).toBe(200);
		expect(nextNumber(["README.md", "notes.md"])).toBe(200);
	});

	it("200 以降の番号が存在する場合は既存の最大番号 +1 を返す", () => {
		expect(nextNumber(["200-a.md", "205-b.md"])).toBe(206);
	});
});

describe("numberedFileName", () => {
	it("3桁ゼロ詰めの番号と slug でファイル名を組む", () => {
		expect(numberedFileName(89, "repo-context-diet")).toBe(
			"089-repo-context-diet.md",
		);
	});
});

describe("SLUG_RE", () => {
	it("英小文字・数字・ハイフンのみを許す", () => {
		expect(SLUG_RE.test("repo-context-diet")).toBe(true);
		expect(SLUG_RE.test("Repo_Context")).toBe(false);
		expect(SLUG_RE.test("日本語")).toBe(false);
	});
});

describe("パスの導出", () => {
	it("検収証跡は現在地から一意に決まる", () => {
		expect(acceptanceFileFor(point)).toBe("docs/acceptance/phase-v0_2-25.md");
	});

	it("Phase の正本は phase<N>.md である", () => {
		expect(planFileFor(point)).toBe("docs/plan/0_2/phase25.md");
	});
});

describe("雛形", () => {
	it("decision は番号・タイトル・日付を埋める", () => {
		const text = decisionTemplate(
			89,
			"リポジトリの情報管理最適化",
			"2026-08-19",
		);
		expect(text).toContain("# 089 リポジトリの情報管理最適化");
		expect(text).toContain("2026-08-19");
	});

	it("acceptance は承認チェックボックスを必ず持つ", () => {
		expect(acceptanceTemplate(point, "2026-08-19")).toContain(
			"- [ ] ユーザー承認",
		);
	});

	it("acceptance は完了判定の正本へのリンクを埋める", () => {
		expect(acceptanceTemplate(point, "2026-08-19")).toContain(
			"docs/plan/0_2/phase25.md",
		);
	});
});

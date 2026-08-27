// 条項 `impl`(plan 版 + Phase)のパースと順序。正本は spec/00-conventions.md「`impl` の書式」。
//
// テスト名に条項 ID を置いていないのは意図的である — tools/ は開発ツールであり対応する条項が無く、
// 既存 ID を借りると偽の実装証跡になる(00-conventions.md「先頭 ID が必須になる範囲」/
// docs/decisions/026 §3)。tools/ は問い1 の対象外。

import { describe, expect, it } from "vitest";
import {
	compareImplPoint,
	formatImplPoint,
	isReached,
	parseImplPoint,
} from "./implPoint.ts";

describe("parseImplPoint", () => {
	it("v<major>_<minor>_<phase> を3整数へ分解する", () => {
		expect(parseImplPoint("v0_1_16")).toEqual({
			major: 0,
			minor: 1,
			phase: 16,
		});
		expect(parseImplPoint("v0_2_1")).toEqual({ major: 0, minor: 2, phase: 1 });
		expect(parseImplPoint("v10_0_0")).toEqual({
			major: 10,
			minor: 0,
			phase: 0,
		});
	});

	it.each([
		["v0_1_01", "先行ゼロ"],
		["v0_01_1", "先行ゼロ(minor)"],
		["0_1_1", "接頭辞 v が無い"],
		["v0_1", "成分が2つ"],
		["v0_1_1_1", "成分が4つ"],
		["v-1_1_1", "負値"],
		["v0_1_1.5", "小数"],
		["16", "旧書式の素の整数"],
		["", "空"],
	])("書式違反 %s(%s)を reject する", (token) => {
		expect(parseImplPoint(token)).toBeUndefined();
	});

	it("formatImplPoint はパースの逆になる", () => {
		for (const token of ["v0_1_1", "v0_1_16", "v0_2_1", "v10_0_0"]) {
			const point = parseImplPoint(token);
			expect(point).toBeDefined();
			if (point === undefined) {
				return;
			}
			expect(formatImplPoint(point)).toBe(token);
		}
	});
});

describe("compareImplPoint", () => {
	function cmp(a: string, b: string): number {
		const pa = parseImplPoint(a);
		const pb = parseImplPoint(b);
		if (pa === undefined || pb === undefined) {
			throw new Error(`書式違反: ${a} / ${b}`);
		}
		return compareImplPoint(pa, pb);
	}

	it("phase を整数として比較する — 文字列比較では誤る組み合わせ", () => {
		// 00-conventions.md が文字列比較を禁止している理由そのもの。
		// 文字列では "v0_1_2" > "v0_1_16" / "v0_1_9" > "v0_1_10" になる。
		expect(cmp("v0_1_2", "v0_1_16")).toBeLessThan(0);
		expect("v0_1_2" > "v0_1_16").toBe(true);

		expect(cmp("v0_1_9", "v0_1_10")).toBeLessThan(0);
		expect("v0_1_9" > "v0_1_10").toBe(true);
	});

	it("major → minor → phase の優先順で比較する", () => {
		expect(cmp("v0_1_16", "v0_2_1")).toBeLessThan(0);
		expect(cmp("v0_2_1", "v0_1_16")).toBeGreaterThan(0);
		expect(cmp("v0_9_9", "v1_0_0")).toBeLessThan(0);
	});

	it("同一の点は 0 を返す", () => {
		expect(cmp("v0_1_5", "v0_1_5")).toBe(0);
	});
});

describe("isReached", () => {
	function reached(impl: string, current: string): boolean {
		const a = parseImplPoint(impl);
		const b = parseImplPoint(current);
		if (a === undefined || b === undefined) {
			throw new Error(`書式違反: ${impl} / ${current}`);
		}
		return isReached(a, b);
	}

	it("現在地と同じか手前の impl を到達済みとする", () => {
		expect(reached("v0_1_1", "v0_1_16")).toBe(true);
		expect(reached("v0_1_16", "v0_1_16")).toBe(true);
	});

	it("別の版の将来 Phase を未到達とする", () => {
		// 現在地 v0_1_16 のとき、v0.2 の条項は問い2 の対象にならない。
		expect(reached("v0_2_1", "v0_1_16")).toBe(false);
	});

	it("版が上がれば前の版の全 Phase が到達済みになる", () => {
		expect(reached("v0_1_16", "v0_2_1")).toBe(true);
	});
});

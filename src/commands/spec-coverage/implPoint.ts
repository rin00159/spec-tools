// 条項の `impl`(plan 版 + Phase)の表現と順序。00-conventions.md「`impl` の書式」が正本。
//
// `v<major>_<minor>_<phase>` を3整数へパースし、**辞書式**で比較する。
// 文字列比較は禁止 — `v0_1_16` は `v0_1_2` より後だが、文字列では前になる。

export interface ImplPoint {
	readonly major: number;
	readonly minor: number;
	readonly phase: number;
}

/** 先行ゼロを許さない(`v0_1_01` は書式違反)。`0` 単体は許す。 */
const IMPL_TOKEN_RE = /^v(0|[1-9]\d*)_(0|[1-9]\d*)_(0|[1-9]\d*)$/;

export const IMPL_TOKEN_SOURCE =
	"v(?:0|[1-9]\\d*)_(?:0|[1-9]\\d*)_(?:0|[1-9]\\d*)";

export function parseImplPoint(token: string): ImplPoint | undefined {
	const match = token.match(IMPL_TOKEN_RE);
	if (!match) {
		return undefined;
	}
	const [, major, minor, phase] = match;
	if (major === undefined || minor === undefined || phase === undefined) {
		return undefined;
	}
	return { major: Number(major), minor: Number(minor), phase: Number(phase) };
}

export function formatImplPoint(point: ImplPoint): string {
	return `v${point.major}_${point.minor}_${point.phase}`;
}

/** a < b なら負、a === b なら 0、a > b なら正。 */
export function compareImplPoint(a: ImplPoint, b: ImplPoint): number {
	return a.major - b.major || a.minor - b.minor || a.phase - b.phase;
}

/** 条項の impl が現在地に到達済みか(spec:coverage 問い2 の対象判定)。 */
export function isReached(impl: ImplPoint, current: ImplPoint): boolean {
	return compareImplPoint(impl, current) <= 0;
}

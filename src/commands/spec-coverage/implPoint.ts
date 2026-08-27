// Representation and ordering of clause `impl` (plan version + Phase). The source of truth is "`impl` format" in spec/00-conventions.md.
//
// Parses `v<major>_<minor>_<phase>` into 3 integers and compares them **lexicographically**.
// String comparison is prohibited — `v0_1_16` comes after `v0_1_2`, but string comparison puts it before.

export interface ImplPoint {
	readonly major: number;
	readonly minor: number;
	readonly phase: number;
}

/** Does not allow leading zeros (`v0_1_01` is an invalid format). A single `0` is allowed. */
const IMPL_TOKEN_RE = /^v(0|[1-9]\d*)_(0|[1-9]\d*)_(0|[1-9]\d*)$/;

export const IMPL_TOKEN_SOURCE = 'v(?:0|[1-9]\\d*)_(?:0|[1-9]\\d*)_(?:0|[1-9]\\d*)';

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

/** Returns a negative value if a < b, 0 if a === b, and a positive value if a > b. */
export function compareImplPoint(a: ImplPoint, b: ImplPoint): number {
	return a.major - b.major || a.minor - b.minor || a.phase - b.phase;
}

/** Checks if the clause's impl point has been reached (target determination for spec:coverage Question 2). */
export function isReached(impl: ImplPoint, current: ImplPoint): boolean {
	return compareImplPoint(impl, current) <= 0;
}

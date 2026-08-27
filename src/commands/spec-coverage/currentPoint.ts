// Resolution of the current point (reached version/Phase). The source of truth is "Location of the current point" in spec/00-conventions.md.
//
// The current point is placed in only one location: `spec/PHASE`. `--phase` is solely for temporary overrides,
// and **multiple specifications result in an error** (if we silently picked the first or last, the user wouldn't realize their input was ignored).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type ImplPoint, parseImplPoint } from './implPoint.ts';

export const PHASE_FILE_NAME = 'PHASE';

/**
 * Extracts exactly one `--phase` override specification.
 * Returns undefined if not specified. **Throws on multiple specifications, missing values, or format violations**.
 */
export function readPhaseOverride(argv: readonly string[]): string | undefined {
	const indices = argv.flatMap((arg, i) => (arg === '--phase' ? [i] : []));
	if (indices.length === 0) {
		return undefined;
	}
	if (indices.length > 1) {
		const given = indices.map((i) => argv[i + 1] ?? '(no value)').join(' / ');
		throw new Error(
			`--phase flag provided ${indices.length} times (${given}). Only one --phase override is allowed.`,
		);
	}
	const index = indices[0];
	if (index === undefined) {
		return undefined;
	}
	const value = argv[index + 1];
	if (value === undefined) {
		throw new Error('Missing value for --phase flag (e.g. --phase v0_1_16)');
	}
	return value;
}

/** Reads `spec/PHASE`. Throws if it does not exist or has an invalid format. */
export async function readPhaseFile(specDir: string): Promise<ImplPoint> {
	const path = join(specDir, PHASE_FILE_NAME);
	let raw: string;
	try {
		raw = await readFile(path, 'utf8');
	} catch {
		throw new Error(
			`Failed to read ${path}. The current implementation phase must be defined in this file.`,
		);
	}
	const token = raw.trim();
	const point = parseImplPoint(token);
	if (point === undefined) {
		throw new Error(
			`Invalid format in ${path}: \`${token}\`. Must be v<major>_<minor>_<phase> (e.g. v0_1_16)`,
		);
	}
	return point;
}

export async function resolveCurrentPoint(
	argv: readonly string[],
	specDir: string,
): Promise<{ readonly point: ImplPoint; readonly overridden: boolean }> {
	const override = readPhaseOverride(argv);
	if (override === undefined) {
		return { point: await readPhaseFile(specDir), overridden: false };
	}
	const point = parseImplPoint(override);
	if (point === undefined) {
		throw new Error(
			`Invalid format for --phase override: \`${override}\`. Must be v<major>_<minor>_<phase> (e.g. v0_1_16)`,
		);
	}
	return { point, overridden: true };
}

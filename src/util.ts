import path from "path";

export const couldBe = <T>(
	maybe: unknown
): maybe is Partial<Record<keyof T, unknown>> => {
	return typeof maybe === "object" && maybe !== null;
};

export const verifyAllUnique = (arr: string[]): undefined | AppError[] => {
	const errors: AppError[] = [];

	const alreadyFoundValue: Record<string, true> = {};
	for (let i = 0; i < arr.length; i++) {
		if (alreadyFoundValue[arr[i]]) {
			errors.push({
				errorType: "AppError",
				msg: `Wiki ID or redirect "${arr[i]}" found more than once`,
			});
		} else {
			alreadyFoundValue[arr[i]] = true;
		}
	}
	if (errors.length) {
		return errors;
	}
};

/**
 *
 * @param absOrRelPath an absolute (/opt/mystuff/file.conf) or relative (../file.conf) file path
 * @param basePath path to base relative paths from. If false, uses process.cwd().
 */
export const pathResolve = (
	absOrRelPath: string,
	basePath: string | false
): string | false => {
	absOrRelPath = absOrRelPath.trim();

	if (!absOrRelPath || absOrRelPath === "/") {
		console.error("Invalid path in pathResolve(): " + absOrRelPath);
		return false;
	}

	const firstChar = absOrRelPath[0];

	// if absOrRelPath starts with a . or DOESN'T start with a /, it's relative
	if (firstChar === "." || firstChar !== "/") {
		const base = basePath || process.cwd();
		return path.resolve(base, absOrRelPath);
	}
	return path.resolve(absOrRelPath); // still resolve to simplify
};

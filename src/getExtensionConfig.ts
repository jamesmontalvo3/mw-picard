import { couldBe, errorIfInvalid } from "./util";

export const isExtensionConfig = (maybe: unknown): maybe is ExtensionConfig => {
	if (!couldBe<ExtensionConfig>(maybe)) {
		console.error("Value is not an object, should be WikiConfig");
		return false;
	}

	let isValid = errorIfInvalid(
		typeof maybe.name === "string",
		"name",
		"string"
	);

	isValid =
		errorIfInvalid(typeof maybe.version === "string", "name", "string") &&
		isValid;

	const hasSource = "repo" in maybe || "composer" in maybe;
	if (!hasSource) {
		console.error(`WikiConfig needs either .repo or .composer value as string`);
	}

	return isValid && hasSource;
};

export const isPartialExtensionConfig = (
	maybe: unknown
): maybe is PartialExtensionConfig => {
	return couldBe<ExtensionConfig>(maybe) && typeof maybe.name === "string";
};

export const isExtensionConfigArray = (
	maybe: unknown
): maybe is ExtensionConfig[] => {
	if (!Array.isArray(maybe)) {
		console.error("Extension config array must be array");
		return false;
	}
	for (const elem of maybe) {
		if (!isExtensionConfig(elem)) {
			console.error("Not a valid WikiConfig: " + JSON.stringify(elem));
			return false;
		}
	}
	return true;
};

export const isPartialExtensionConfigArray = (
	maybe: unknown
): maybe is PartialExtensionConfig[] => {
	if (!Array.isArray(maybe)) {
		return false;
	}
	for (const elem of maybe) {
		if (!isPartialExtensionConfig(elem)) {
			return false;
		}
	}
	return true;
};

export const mergeExtensionConfigs = (
	baseline: ExtensionConfig,
	specifier: PartialExtensionConfig
): ExtensionConfig => {
	const merged = { ...baseline, ...specifier };

	// If one of the baseline/specifier is a composer extension and the other is standard, use
	// whatever the specifier says
	if ("composer" in merged && "repo" in merged) {
		if ("composer" in specifier) {
			delete merged.repo;
		} else {
			delete merged.composer;
		}
	}
	return merged;
};

const getExtensionConfig = (
	baselines: ExtensionConfig[],
	selection: PartialExtensionConfig[]
): ExtensionConfig[] => {
	const baselineIndexes: Record<string, number> = {};
	for (let i = 0; i < baselines.length; i++) {
		const ext = baselines[i];
		baselineIndexes[ext.name] = i;
	}
	const result: ExtensionConfig[] = [];
	for (const ext of selection) {
		const { name } = ext;
		if (typeof baselineIndexes[name] === "number") {
			result.push(mergeExtensionConfigs(baselines[baselineIndexes[name]], ext));
		} else if (isExtensionConfig(ext)) {
			result.push(ext);
		} else {
			console.error(
				`Extension "${name}" does not have complete config. Skipping.`
			);
		}
	}
	return result;
};

export default getExtensionConfig;

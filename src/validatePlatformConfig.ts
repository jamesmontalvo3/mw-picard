import { promises as fsp } from "fs";
import path from "path";
import { couldBe, pathResolve, verifyAllUnique } from "./util";

const errorIfInvalid = (
	isValid: boolean,
	property: string,
	type: string
): void => {
	if (!isValid) {
		console.error(`Expected ${property} to be ${type}`);
	}
};

const hasStringProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: string } => {
	const valid = property in obj && typeof obj[property] === "string";
	errorIfInvalid(valid, property, "string");
	return valid;
};

const hasBooleanProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: boolean } => {
	const valid = property in obj && typeof obj[property] === "boolean";
	errorIfInvalid(valid, property, "boolean");
	return valid;
};

const hasBooleanOrUndefinedProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: boolean | undefined } => {
	if (!(property in obj)) {
		return true;
	}
	const valid = typeof obj[property] === "boolean";
	errorIfInvalid(valid, property, "boolean or undefined");
	return valid;
};

const isArrayOfStrings = (value: unknown): value is string[] => {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
};

const hasArrayOfStringsOrUndefinedProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: string[] | undefined } => {
	if (!(property in obj)) {
		return true;
	}
	const valid = isArrayOfStrings(obj[property]);
	errorIfInvalid(valid, property, "array of strings or undefined");
	return valid;
};

const hasArrayOfStringsProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: string[] } => {
	const valid = property in obj && isArrayOfStrings(obj[property]);
	errorIfInvalid(valid, property, "array of strings");
	return valid;
};

const isMezaAuthType = (value: unknown): value is MezaAuthType => {
	if (typeof value !== "string") {
		return false;
	}

	return [
		"none",
		"anon-read",
		"anon-edit",
		"user-edit",
		"user-read",
		"viewer-read",
	].includes(value);
};

const hasMezaAuthTypeProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: MezaAuthType } => {
	const valid = isMezaAuthType(obj[property]);
	errorIfInvalid(valid, property, "a meza auth type");
	return valid;
};

const hasMezaAuthTypeOrUndefinedProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: MezaAuthType | undefined } => {
	if (!(property in obj)) {
		return true;
	}
	const valid = isMezaAuthType(obj[property]);
	errorIfInvalid(valid, property, "a meza auth type or undefined");
	return valid;
};

const validateWikiConfig = (value: unknown): WikiConfig | false => {
	if (!couldBe<WikiConfig>(value)) {
		return false;
	}

	if (
		!hasStringProp(value, "id") ||
		!hasStringProp(value, "dbName") ||
		!hasStringProp(value, "sitename") ||
		!hasBooleanOrUndefinedProp(value, "isPrimaryWiki") ||
		!hasArrayOfStringsOrUndefinedProp(value, "redirectsFrom") ||
		!hasMezaAuthTypeOrUndefinedProp(value, "wikiMezaAuthType")
	) {
		return false;
	}

	return value;
};

const isArrayOfWikiConfig = (value: unknown): value is WikiConfig[] => {
	return (
		Array.isArray(value) && value.every((item) => validateWikiConfig(item))
	);
};

const hasWikiConfigArrayProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: WikiConfig[] } => {
	return isArrayOfWikiConfig(obj[property]);
};

const validateWikis = (
	wikis: unknown
): WikiConfig[] | { errors: AppError[] } => {
	const errObj: { errors: AppError[] } = { errors: [] };

	if (!isArrayOfWikiConfig(wikis)) {
		errObj.errors.push({
			errorType: "AppError",
			msg: "'wikis' is not an array of WikiConfig",
		});
		return errObj;
	}

	const idsAndRedirects: string[] = [];

	let primaryWiki: string | undefined;

	for (const wiki of wikis) {
		idsAndRedirects.push(wiki.id);
		if (wiki.redirectsFrom) {
			idsAndRedirects.push(...wiki.redirectsFrom);
		}

		if (wiki.isPrimaryWiki && primaryWiki) {
			errObj.errors.push({
				errorType: "AppError",
				msg: `Tried to set ${wiki.id} as primary wiki when already set to ${primaryWiki}`,
			});
		} else {
			primaryWiki = wiki.id;
		}
	}

	const uniqueErrors = verifyAllUnique(idsAndRedirects);
	if (uniqueErrors) {
		errObj.errors.push(...uniqueErrors);
	}

	if (errObj.errors.length) {
		return errObj;
	}

	return wikis;
};

const hasExtensionFilesProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: { specifier: string; baseline: string } } => {
	const val = obj[property];
	if (
		typeof val === "object" &&
		val !== null &&
		"specifier" in val &&
		"baseline" in val
	) {
		return (
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			typeof (val as any).specifier === "string" &&
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			typeof (val as any).baseline === "string"
		);
	} else {
		return false;
	}
};

export const loadPlatformConfig = async (
	absOrRelConfigPath: string
): Promise<PlatformConfig | string> => {
	const configPath = pathResolve(absOrRelConfigPath, false);
	if (!configPath) {
		return `Invalid platform config path: ${absOrRelConfigPath}`;
	}
	const dir = path.dirname(configPath);

	let config: unknown;
	try {
		const fileContents = await fsp.readFile(configPath, "utf-8");
		config = JSON.parse(fileContents);
	} catch (err) {
		return "Unable to load platform config from " + configPath;
	}

	if (!couldBe<PlatformConfig>(config)) {
		return "config is not an object and thus is missing all required properties";
	}

	if (
		!hasStringProp(config, "appMediawikiPath") ||
		!hasStringProp(config, "appUploadsDirectory") ||
		!hasStringProp(config, "controllerComposerCmd") ||
		!hasStringProp(config, "controllerMediawikiPath") ||
		!hasStringProp(config, "appMoreConfigPath") ||
		!hasStringProp(config, "wikiAppFqdn") ||
		!hasStringProp(config, "wgPasswordSender") ||
		!hasStringProp(config, "wgEmergencyContact") ||
		!hasStringProp(config, "wgSecretKey") ||
		!hasStringProp(config, "appCacheDirectory") ||
		!hasStringProp(config, "wgLocaltimezone") ||
		!hasStringProp(config, "dbMaster") ||
		!hasStringProp(config, "wikiAppDbPassword") ||
		!hasStringProp(config, "wikiAppDbUser") ||
		!hasStringProp(config, "thisServer") ||
		!hasBooleanProp(config, "allowRequestDebug") ||
		!hasBooleanProp(config, "enableEmail") ||
		!hasBooleanProp(config, "wgAllowExternalImages") ||
		!hasBooleanProp(config, "wgAllowImageTag") ||
		!hasArrayOfStringsProp(config, "loadBalancers") ||
		!hasArrayOfStringsProp(config, "memcachedServers") ||
		!hasArrayOfStringsProp(config, "elasticsearchServers") ||
		!hasArrayOfStringsOrUndefinedProp(config, "dbReplicas") ||
		!hasMezaAuthTypeProp(config, "systemMezaAuthType") ||
		!hasWikiConfigArrayProp(config, "wikis") ||
		!hasExtensionFilesProp(config, "extensionsFiles") // fixme extensionsFiles versus extensionFiles
	) {
		return "Properties missing or incorrect types";
	}

	const wikisValid = validateWikis(config.wikis);
	if ("errors" in wikisValid) {
		return (
			"Validating individual wiki config failed with the following errors:\n  " +
			wikisValid.errors.join("\n  ")
		);
	}

	const resolvedBaseline = pathResolve(config.extensionsFiles.baseline, dir);
	const resolvedSpecifier = pathResolve(config.extensionsFiles.specifier, dir);

	if (!resolvedBaseline) {
		return "Invalid baseline extension config";
	}

	if (!resolvedSpecifier) {
		return "Invalid specifier extension config";
	}

	config.extensionsFiles.baseline = resolvedBaseline;
	config.extensionsFiles.specifier = resolvedSpecifier;

	return config;
};

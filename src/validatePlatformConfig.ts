import { couldBe, verifyAllUnique } from "./util";

const hasStringProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: string } => {
	return property in obj && typeof obj[property] === "string";
};

const hasBooleanProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: boolean } => {
	return property in obj && typeof obj[property] === "boolean";
};

const hasBooleanOrUndefinedProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: boolean | undefined } => {
	if (!(property in obj)) {
		return true;
	}
	return typeof obj[property] === "boolean";
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
	return isArrayOfStrings(obj[property]);
};

const hasArrayOfStringsProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: string[] } => {
	return property in obj && isArrayOfStrings(obj[property]);
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
	return isMezaAuthType(obj[property]);
};

const hasMezaAuthTypeOrUndefinedProp = <K extends string>(
	obj: Record<string, unknown>,
	property: K
): obj is { [property in K]: MezaAuthType | undefined } => {
	if (!(property in obj)) {
		return true;
	}
	return isMezaAuthType(obj[property]);
};

const validateWikiConfig = (value: unknown): WikiConfig | false => {
	if (!couldBe<WikiConfig>(value)) {
		return false;
	}

	if (!hasStringProp(value, "id")) {
		console.error("Wiki Config 'id' field must be a string");
		return false;
	}

	if (!hasStringProp(value, "dbName")) {
		console.error("Wiki Config 'dbName' field must be a string");
		return false;
	}

	if (!hasStringProp(value, "sitename")) {
		console.error("Wiki Config 'sitename' field must be a string");
		return false;
	}

	if (!hasBooleanOrUndefinedProp(value, "isPrimaryWiki")) {
		console.error(
			"Wiki Config 'isPrimaryWiki' field must be a boolean or undefined"
		);
		return false;
	}

	if (!hasArrayOfStringsOrUndefinedProp(value, "redirectsFrom")) {
		console.error(
			"Wiki Config 'redirectsFrom' field must be an array of strings or undefined"
		);
		return false;
	}

	if (!hasMezaAuthTypeOrUndefinedProp(value, "wikiMezaAuthType")) {
		console.error(
			"Wiki Config 'id' field must be a Meza Auth Type or undefined"
		);
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

const validateWikis = (wikis: unknown): WikiConfig[] | AppError[] => {
	if (!isArrayOfWikiConfig(wikis)) {
		return [
			{ errorType: "AppError", msg: "'wikis' is not an array of WikiConfig" },
		];
	}

	const idsAndRedirects: string[] = [];

	let primaryWiki: string | undefined;
	const errors: AppError[] = [];

	for (const wiki of wikis) {
		idsAndRedirects.push(wiki.id);
		if (wiki.redirectsFrom) {
			idsAndRedirects.push(...wiki.redirectsFrom);
		}

		if (wiki.isPrimaryWiki && primaryWiki) {
			errors.push({
				errorType: "AppError",
				msg: `Tried to set ${wiki.id} as primary wiki when already set to ${primaryWiki}`,
			});
		} else {
			primaryWiki = wiki.id;
		}
	}

	const uniqueErrors = verifyAllUnique(idsAndRedirects);
	if (uniqueErrors) {
		errors.push(...uniqueErrors);
	}

	if (errors.length) {
		return errors;
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

export const validatePlatformConfig = (
	config: unknown
): PlatformConfig | string => {
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
		return "Missing stuff"; // fixme
	}

	return config;
};

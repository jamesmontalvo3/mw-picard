import path from "path";
import { promises as fsp } from "fs";
import YAML from "js-yaml";
import getExtensionConfig, {
	isExtensionConfigArray,
	isPartialExtensionConfigArray,
} from "./getExtensionConfig";
import doExtensions, { DoExtensionsResult } from "./doExtensions";

type ProcessExtensionsProps = {
	baseline: string;
	specifier: string;
	mediawiki: string;
	composerCmd: string;
	extensions: string;
	skins: string;
};

const loadYamlFile = async (
	filepath: string,
	allowMissing?: boolean
): Promise<unknown> => {
	let content: Buffer;

	try {
		content = await fsp.readFile(filepath);
	} catch (err) {
		if (allowMissing) {
			return false;
		}
		throw err;
	}

	return YAML.load(content.toString());
};

const processExtensions = async (
	paths: ProcessExtensionsProps
): Promise<DoExtensionsResult> => {
	let baseline: ExtensionConfig[] | false = false;
	let specifier: PartialExtensionConfig[] | false = false;
	let priorInstallation: ExtensionConfig[] | false;
	const configDir = path.dirname(paths.specifier);
	const priorInstallationFilePath = path.join(
		configDir,
		"prior-installation.yml"
	);

	try {
		const baselineMaybe = await loadYamlFile(paths.baseline);
		if (isExtensionConfigArray(baselineMaybe)) {
			baseline = baselineMaybe;
		}

		const specifierMaybe = await loadYamlFile(paths.specifier);
		if (isPartialExtensionConfigArray(specifierMaybe)) {
			specifier = specifierMaybe;
		}

		const installedMaybe = await loadYamlFile(priorInstallationFilePath, true);
		priorInstallation =
			installedMaybe === false || !isExtensionConfigArray(installedMaybe)
				? false
				: installedMaybe;
	} catch (err) {
		return { status: "ERROR" }; // FIXME return error?
	}

	if (!baseline || !specifier) {
		return { status: "ERROR" }; // fixme throw? return error?
	}

	const extensionsConfig = getExtensionConfig(baseline, specifier);

	// FIXME has enabling/disabling SMW in wiki farm been figured out?

	// 1. Git-clone/checkout extensions
	//        1. Do extension submodule updates as necessary
	// 2. Ditto for skins
	// 2a. Remove directories in extensions/ and skins/ that don't belong ???
	const result = await doExtensions({
		extensionsPath: paths.extensions,
		skinsPath: paths.skins,
		mediawikiPath: paths.mediawiki,
		composerCmd: paths.composerCmd,
		extensionsConfig,
		priorInstallation,
	});

	if (result.status === "ERROR" || result.status === "NOCHANGE") {
		return result;
	}

	// Generate specifier `.installed.yml`
	await fsp.writeFile(priorInstallationFilePath, YAML.dump(extensionsConfig));

	return result;
};

export default processExtensions;

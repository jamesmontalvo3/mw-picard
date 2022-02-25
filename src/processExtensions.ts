import path from "path";
import { promises as fsp } from "fs";
import YAML from "js-yaml";
import getExtensionConfig, {
	isExtensionConfig,
	isExtensionConfigArray,
	isPartialExtensionConfigArray,
} from "./getExtensionConfig";

type ProcessExtensionsProps = {
	baseline: string;
	specifier: string;
	mediawiki: string;
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
): Promise<boolean> => {
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
		return false; // FIXME return error?
	}

	if (!baseline || !specifier) {
		return false; // fixme throw? return error?
	}

	const extensionConfig = getExtensionConfig(baseline, specifier);

	// FIXME has enabling/disabling SMW in wiki farm been figured out?

	const priorInstallationMap: ExtensionConfigMap = {};
	if (priorInstallation) {
		for (const ext of priorInstallation) {
			priorInstallationMap[ext.name] = ext;
		}
	}

	// 1. Git-clone/checkout extensions
	//        1. Do extension submodule updates as necessary
	// 2. Ditto for skins
	// 2a. Remove directories in extensions/ and skins/ that don't belong ???
	const gitResult = await doGitExtensions({
		extensionsPath: paths.extensions,
		skinsPath: paths.skins,
		extensionsConfig,
		priorExtensions: priorInstallationMap,
	});

	// 3. Create composer.local.json
	const composerJsonChanged = await createComposerLocalJson({
		mediawikiPath: paths.mediawiki,
		extensionConfig,
	});

	// 4. Run composer install/update
	if (composerJsonChanged) {
		const composerUpdateResult = await runComposerInstallUpdate({
			mediawikiPath: paths.mediawiki,
		});
	}

	// 5. Generate specifier `.installed.yml`
	await fsp.writeFile(priorInstallationFilePath, YAML.dump(extensionConfig));

	// 6. Generate `ExtensionSettings.php`
	const extSettingsResult = await createExtensionSettings({
		extensionsPath: paths.extensions,
		skinsPath: paths.skins,
		extensionConfig,
	});

	// 7. Generate `update-php-required.json`
	const updatePhpRequiredResult = await generateUpdatePhpRequiredJson({
		extensionConfig,
		priorExtensions: priorInstallationMap,
		configDir,
	});

	return 1;
};

export default processExtensions;

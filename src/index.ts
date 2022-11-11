#!/usr/bin/env node
// needs to start with shebang ^ since this file is what is called via `mw-picard` command

import fs from "fs";
import path from "upath";
import doLocalSettings from "./doLocalSettings";
import processExtensions from "./processExtensions";
import { loadPlatformConfig } from "./validatePlatformConfig";

const run = async (
	platformYamlPath: string | undefined,
	priorInstallPath: string | undefined,
	noExtensionsOption: string | undefined
): Promise<void> => {
	if (!platformYamlPath) {
		console.error("Please supply path to platform.yml as first arg");
		process.exit(1);
	}

	const platformConfig = await loadPlatformConfig(platformYamlPath);

	if (typeof platformConfig === "string") {
		console.error(platformConfig);
		process.exit(1);
	}

	const { controllerComposerCmd, extensionsFiles, controllerMediawikiPath } =
		platformConfig;

	const configDir = path.dirname(extensionsFiles.specifier);
	const priorInstallationFilePath =
		priorInstallPath || path.join(configDir, "prior-installation.yml");

	const dontGetExtensions = noExtensionsOption === "--no-extensions";

	const extensionUpdateResult = await processExtensions({
		baseline: extensionsFiles.baseline,
		specifier: extensionsFiles.specifier,
		mediawiki: controllerMediawikiPath,
		controllerComposerCmd,
		priorInstallationFilePath,
		dontGetExtensions,
	});

	const jsonResult = JSON.stringify(extensionUpdateResult, null, 2);

	if (extensionUpdateResult.status === "ERROR") {
		console.error("An error occurred.\n\n" + jsonResult);
		process.exit(1);
	}

	const ls = doLocalSettings(platformConfig);

	if (typeof ls !== "string") {
		console.error(
			"Error occurred while creating LocalSettings.php: ",
			ls.errors
		);
		process.exit(1);
	}

	const lsPath = path.join(controllerMediawikiPath, "LocalSettings.php");
	try {
		await fs.promises.writeFile(lsPath, ls);
	} catch (err) {
		console.error(`Unable to write ${lsPath}: `, err);
		process.exit(1);
	}

	// create wiki-databases.txt for easy looping over in shell
	const wikiDatabasesTxtPath = path.join(
		path.dirname(platformYamlPath),
		"wiki-databases.txt"
	);
	try {
		const content = platformConfig.wikis
			.map(({ id, dbName }) => `${id}:${dbName}`)
			.join("\n");
		await fs.promises.writeFile(wikiDatabasesTxtPath, content);
	} catch (err) {
		console.error(`Unable to write ${wikiDatabasesTxtPath}: `, err);
		process.exit(1);
	}

	// eslint-disable-next-line no-console
	console.log(jsonResult);
};

run(process.argv[2], process.argv[3], process.argv[4]);

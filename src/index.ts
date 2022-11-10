import fs from "fs";
import path from "upath";
import doLocalSettings from "./doLocalSettings";
import processExtensions from "./processExtensions";
import { loadPlatformConfig } from "./validatePlatformConfig";

const run = async (platformYamlPath: string | undefined): Promise<void> => {
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

	const extensionUpdateResult = await processExtensions({
		baseline: extensionsFiles.baseline,
		specifier: extensionsFiles.specifier,
		mediawiki: controllerMediawikiPath,
		controllerComposerCmd,
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

	// eslint-disable-next-line no-console
	console.log(jsonResult); // fixme how is "run update.php or not" info used?

	// FIXME need to write .env file

	// FIXME fix all jinja m_variables
};

run(process.argv[2]);

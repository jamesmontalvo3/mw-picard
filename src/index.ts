import fs from "fs";
import path from "path";
import doLocalSettings from "./doLocalSettings";
import processExtensions from "./processExtensions";
import { validatePlatformConfig } from "./validatePlatformConfig";

const run = async (platformYamlPath: string | undefined): Promise<void> => {
	if (!platformYamlPath) {
		console.error("Please supply path to platform.yml as first arg");
		process.exit(1);
	}

	let platformConfig: PlatformConfig | string;

	try {
		const fileContents = await fs.promises.readFile(platformYamlPath, "utf-8");

		// FIXME
		// FIXME
		// FIXME - validate platformConfig and give excellent error messages
		// FIXME
		// FIXME
		platformConfig = validatePlatformConfig(JSON.parse(fileContents));
	} catch (err) {
		console.error(
			"Unable to load platform config from " + platformYamlPath,
			err
		);
		process.exit(1);
	}

	if (platformConfig === false) {
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
};

run(process.argv[2]);

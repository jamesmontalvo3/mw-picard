#!/usr/bin/env node
// needs to start with shebang ^ since this file is what is called via `mw-picard` command

import processExtensions from "./processExtensions";

const run = async (
	baselineExtConfigPath: string | undefined,
	mediawikiPath: string | undefined
): Promise<void> => {
	if (!baselineExtConfigPath) {
		console.error("Please supply path to baseline.yml as first arg");
		process.exit(1);
	}
	if (!mediawikiPath) {
		console.error("Please supply path to mediawiki directory as second arg");
		process.exit(1);
	}

	const extensionUpdateResult = await processExtensions({
		baselineExtConfig: baselineExtConfigPath,
		mediawikiPath,
	});

	const jsonResult = JSON.stringify(extensionUpdateResult, null, 2);

	if (extensionUpdateResult.status === "ERROR") {
		console.error("An error occurred.\n\n" + jsonResult);
		process.exit(1);
	}

	// eslint-disable-next-line no-console
	console.log(jsonResult);
};

run(process.argv[2], process.argv[3]);

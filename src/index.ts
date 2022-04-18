import packageJSON from "../package.json";
import processExtensions from "./processExtensions";


type GetExtOptions = {
	baseline?: string;
	specifier?: string;
	mediawiki?: string;
	extensions?: string;
	skins?: string;
};

program
	.command("get-ext")
	.description("Get extension configuration")
	.option(
		"--baseline <file>",
		"YAML file to pull baseline extension config from",
		false
	)
	.option(
		"--specifier <file>",
		"YAML file to pull specifier extension config from",
		false
	)
	.option(
		"--mediawiki <directory>",
		"Path to MediaWiki directory (in which extensions/ and skins/ typically reside)",
		false
	)
	.action(async (options: GetExtOptions) => {
		const { baseline, specifier, mediawiki } = options;

		if (!baseline || !specifier || !mediawiki) {
			program.error("Need to provide --baseline, --specifier, and --mediawiki");
			return;
		}

		const result = await processExtensions({
			baseline,
			specifier,
			mediawiki,
			composerCmd: "/usr/bin/composer",
		});

		const jsonResult = JSON.stringify(result, null, 2);

		if (result.status === "ERROR") {
			console.log("An error occurred.\n\n" + jsonResult); // eslint-disable-line no-console
		}

		console.log(jsonResult); // eslint-disable-line no-console
	});

program.parse();

const index = async () => {

}

index()
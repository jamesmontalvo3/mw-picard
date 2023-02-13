import getExtensionConfig, {
	isExtensionConfigArray,
} from "./getExtensionConfig";
import doExtensions, { DoExtensionsResult } from "./doExtensions";
import { loadYamlFile } from "./util";

const processExtensions = async (config: {
	baselineExtConfig: string;
	mediawikiPath: string;
}): Promise<DoExtensionsResult> => {
	let baseline: ExtensionConfig[] | false = false;

	try {
		const baselineMaybe = await loadYamlFile(config.baselineExtConfig);
		if (isExtensionConfigArray(baselineMaybe)) {
			baseline = baselineMaybe;
		}
	} catch (err) {
		console.error(err);
		return {
			status: "ERROR",
			msg: "Error loading extension config. Error was: " + JSON.stringify(err),
		};
	}

	if (!baseline) {
		const which = [];
		if (!baseline) {
			which.push("baseline");
		}
		return { status: "ERROR", msg: which.join(" and ") + " invalid" };
	}

	const extensionsConfig = getExtensionConfig(baseline, baseline);

	// 1. Git-clone/checkout extensions
	//        1. Do extension submodule updates as necessary
	// 2. Ditto for skins
	// 2a. Remove directories in extensions/ and skins/ that don't belong ???
	const result = await doExtensions({
		appMediawikiPath: config.mediawikiPath,
		controllerComposerCmd: "/dont/run/composer",
		extensionsConfig,
		priorInstallation: false,
		runComposerCmd: false,
		dontGetExtensions: false,
	});

	if (result.status === "ERROR" || result.status === "NOCHANGE") {
		return result;
	}

	return result;
};

export default processExtensions;

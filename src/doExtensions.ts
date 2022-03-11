import path from "path";
import { promises as fsp } from "fs";
import { asyncRimraf } from "./asyncRimraf";
import { asyncExec } from "./asyncExec";
import propsMatch from "./propsMatch";
import difference from "lodash/difference";
import deepEqual from "lodash/isEqual";
import { uniq } from "lodash";
import packageJson from "../package.json";

const codeProps = ["name", "version", "composer", "repo", "skin"];
const confProps = ["config", "more_config"];

export const shouldUpdateExtension = (
	newConf: ExtensionConfig,
	oldConf?: ExtensionConfig
): boolean => {
	if (!oldConf) {
		return true;
	}
	if (propsMatch(newConf, oldConf, codeProps)) {
		return false;
	}
	return true;
};

/**
 * Whether or not (true or false) an extension requires update.php to be run, or if the extension is
 * only enabled on some wikis, what wikis require update (array of wiki IDs). The cases for when to
 * update.php are as follows, and each case is covered in tests:
 *
 * Unchanged extension:
 * Case 1: should not-update.php       if no-change AND all-wikis-before AND all-wikis-now
 * Case 2: should not-update.php       if no-change AND all-wikis-before AND select-wikis-now
 * Case 3: should update.php-all       if no-change AND select-wikis-before AND all-wikis-now [1]
 * Case 4: should update.php-new-wikis if no-change AND select-wikis-before AND select-wikis-now [2]
 * Changed extension:
 * Case 5: should update.php-all       if changed AND all-wikis-before AND all-wikis-now
 * Case 6: should update.php-now-wikis if changed AND all-wikis-before AND select-wikis-now
 * Case 7: should update.php-all       if changed AND select-wikis-before AND all-wikis-now
 * Case 8: should update.php-now-wikis if changed AND select-wikis-before AND select-wikis-now
 *
 * Notes:
 * [1] Really these could be only update (allWikis - specified) but we can't calculate that
 * [2] Returns difference between now and before, unless the difference is zero, then return false
 */
export const shouldRunUpdatePhp = (
	newConf: ExtensionConfig,
	oldConf?: ExtensionConfig
): boolean | string[] => {
	if (!newConf.update_php_on_change) {
		return false;
	}
	if (!oldConf) {
		return newConf.wikis || true;
	}

	const propsToCheck =
		newConf.update_php_on_change === "code-changes"
			? codeProps
			: [...codeProps, ...confProps];

	const extensionIsUnchanged = propsMatch(newConf, oldConf, propsToCheck);

	const beforeWikis = oldConf.wikis;
	const nowWikis = newConf.wikis;

	const newWikis = difference(oldConf.wikis || [], newConf.wikis || []);

	// See docs for this function regarding cases
	if (extensionIsUnchanged && !beforeWikis) {
		// not-beforeWikis means no wikis specified before, and thus the extension was installed on
		// all wikis before
		return false; // latest extension is already on all wikis (case 1 and 2)
	} else if (!nowWikis) {
		return true; // case 3, 5, and 7
	} else if (extensionIsUnchanged) {
		const ret = newWikis.length ? newWikis : false;
		return ret; // case 4 (1, 2, and 3 already removed, 4 only left for no-change)
	}
	return nowWikis; // case 6 and 8
};

export const createLoadCommand = (ext: ExtensionConfig): string => {
	if ("composer" in ext) {
		return ""; // Not all Composer extensions require loading
	} else if (ext.legacy_load) {
		const mwInstallPath = "$IP"; // When MediaWiki includes ExtensionSettings.php, $IP is set
		const type = ext.skin ? "skins" : "extensions";
		const extensionRequirePath = `${mwInstallPath}/${type}/${ext.name}/${ext.name}.php`;
		return `require_once '${extensionRequirePath}';\n`;
	}

	return ext.skin
		? `wfLoadSkin( "${ext.name}" );\n`
		: `wfLoadExtension( "${ext.name}" );\n`;
};

// FIXME add test for empty wikis array (git clones ext, but no wiki uses it)
export const createExtensionSettings = (ext: ExtensionConfig): string => {
	const commentHeader = `/**** ${ext.name} @ ${ext.version} ****/\n`;

	const config = ext.config ? ext.config + "\n" : "";
	const moreConfig = ext.more_config ? ext.more_config + "\n" : "";

	const conf = createLoadCommand(ext) + config + moreConfig;

	if (ext.wikis) {
		const wikisPhpArray = "[" + ext.wikis.map((w) => `'${w}'`).join(", ") + "]";
		const indentedConf = "\t" + conf.trim().replace(/\n/gi, "\n\t");
		return `${commentHeader}if ( in_array( $wikiId, ${wikisPhpArray} ) ) {\n${indentedConf}\n}\n\n`;
	} else {
		return commentHeader + conf + "\n";
	}
};

export const isGitRepo = async (dir: string): Promise<boolean> => {
	try {
		await fsp.access(dir);
	} catch (err) {
		return false;
	}

	try {
		await fsp.access(path.join(dir, ".git"));
	} catch (err) {
		// directory exists but is not a git repo. remove the directory.
		await asyncRimraf(dir);

		return false;
	}

	return true;
};

// FIXME needed?
type GitCloneProps = {
	cloneDirectory: string;
	repo: string;
	version: string;
};

type CheckoutProps = {
	cloneDirectory: string;
	version: string;
	fetch: boolean;
	eraseChanges: boolean;
};

/**
 * Returns a command like: `git checkout ${version}`, optionally prefixed with `git fetch &&`, etc
 */
export const gitCheckoutCommand = ({
	cloneDirectory,
	version,
	fetch,
	eraseChanges,
}: CheckoutProps): string => {
	const cmd = [`cd ${cloneDirectory}`];
	if (fetch) {
		cmd.push("git fetch");
	}
	if (eraseChanges) {
		cmd.push("git reset --hard HEAD && git clean -f");
	}

	// FIXME: if version is a branch, this might not change anything without origin/${version}
	// I don't really want to get into that, since Meza should pin commits or tags /FIXME
	cmd.push(`git checkout ${version}`);

	return cmd.join(" && ");
};

const runCommand = async (cmd: string): Promise<boolean> => {
	try {
		await asyncExec(cmd);
	} catch (err) {
		console.error(err);
		return false;
	}

	return true;
};

export const makeGitRight = async ({
	cloneDirectory,
	repo,
	version,
}: GitCloneProps): Promise<boolean> => {
	const cmd = (await isGitRepo(cloneDirectory))
		? gitCheckoutCommand({
				cloneDirectory,
				version,
				fetch: true,
				eraseChanges: true,
		  })
		: `git clone ${repo} ${cloneDirectory} && ` +
		  gitCheckoutCommand({
				cloneDirectory,
				version,
				fetch: false,
				eraseChanges: false,
		  });

	return runCommand(cmd);
};

export type ComposerJson = {
	require: Record<string, string>;
	extra: {
		"merge-plugin": {
			include: string[];
		};
	};
};

export const composerLocalJsonify = (composerJson: ComposerJson): string => {
	return JSON.stringify(composerJson, null, 2);
};

export const doComposerExtensions = async ({
	mediawikiPath,
	composerCmd,
	extensions,
}: {
	mediawikiPath: string;
	composerCmd: string;
	extensions: ExtensionConfig[];
}): Promise<boolean> => {
	const composerJson: ComposerJson = {
		require: {},
		extra: {
			"merge-plugin": {
				include: [],
			},
		},
	};

	for (const ext of extensions) {
		if ("composer" in ext) {
			composerJson.require[ext.composer] = ext.version;
		}
		if (ext.composer_merge) {
			const dir = ext.skin ? "skins" : "extensions";
			composerJson.extra["merge-plugin"].include.push(
				`${dir}/${ext.name}/composer.json`
			);
		}
	}
	const composerJsonPath = path.join(mediawikiPath, "composer.local.json");
	try {
		const currentFile = await fsp.readFile(composerJsonPath, "utf-8");
		const current = JSON.parse(currentFile);
		if (deepEqual(composerJson, current)) {
			return true;
		}
	} catch (err) {}

	const json = composerLocalJsonify(composerJson);

	try {
		await fsp.writeFile(composerJsonPath, json);
	} catch (err) {
		return false;
	}

	return runCommand(
		`cd ${mediawikiPath} && ${composerCmd} install && ${composerCmd} update`
	);
};

export const doExtensionSettings = async ({
	extensionsPath,
	extensionsConfig,
}: {
	extensionsPath: string;
	extensionsConfig: ExtensionConfig[];
}): Promise<boolean> => {
	let extensionSettings = `<?php\n\n/**\n * This file is automatically generated by mw-picard v${packageJson.version}\n */\n\n`;
	for (const ext of extensionsConfig) {
		extensionSettings += createExtensionSettings(ext);
	}

	try {
		await fsp.writeFile(
			path.join(extensionsPath, "ExtensionSettings.php"),
			extensionSettings
		);
		return true;
	} catch (err) {
		console.error(err);
		return false;
	}
};

export type DoExtensionsResult =
	| { status: "ERROR" }
	| { status: "NOCHANGE" }
	| {
			status: "CHANGED";
			runUpdatePhp: boolean | string[];
	  };

const doExtensions = async ({
	mediawikiPath,
	composerCmd,
	extensionsConfig,
	priorInstallation,
}: {
	mediawikiPath: string;
	composerCmd: string;
	extensionsConfig: ExtensionConfig[];
	priorInstallation: ExtensionConfig[] | false;
}): Promise<DoExtensionsResult> => {
	const skinsPath = path.join(mediawikiPath, "skins");
	const extensionsPath = path.join(mediawikiPath, "extensions");

	const changesMade = !deepEqual(extensionsConfig, priorInstallation);
	if (!changesMade) {
		return { status: "NOCHANGE" };
	}

	const priorInstallationMap: ExtensionConfigMap = {};
	if (priorInstallation) {
		for (const ext of priorInstallation) {
			priorInstallationMap[ext.name] = ext;
		}
	}

	let runUpdatePhp: boolean | string[] = false;

	for (const ext of extensionsConfig) {
		if ("composer" in ext) {
			continue;
		}
		if (!shouldUpdateExtension(ext, priorInstallationMap[ext.name])) {
			continue;
		}

		const cloneDirectory = path.join(
			ext.skin ? skinsPath : extensionsPath,
			ext.name
		);

		const success = await makeGitRight({
			cloneDirectory,
			repo: ext.repo,
			version: ext.version,
		});

		if (!success) {
			return { status: "ERROR" };
		}
	}

	for (const ext of extensionsConfig) {
		if (runUpdatePhp === true) {
			break; // if it's already set to run for all wikis, no reason to check any more
		}

		const result = shouldRunUpdatePhp(ext, priorInstallationMap[ext.name]);

		if (result === true) {
			runUpdatePhp = true;
			continue; // could break, but continuing allows break above to be test-covered
		} else if (result === false) {
			continue; // keep whatever runUpdatePhp is now
		}

		// at this point result could only be an array of strings and runUpdatePhp !== true
		if (runUpdatePhp === false) {
			runUpdatePhp = result;
		} else {
			runUpdatePhp = uniq([...runUpdatePhp, ...result]);
		}
	}

	const extSettingsSuccess = await doExtensionSettings({
		extensionsPath,
		extensionsConfig,
	});

	if (!extSettingsSuccess) {
		return { status: "ERROR" };
	}

	const composerSuccess = await doComposerExtensions({
		mediawikiPath,
		composerCmd,
		extensions: extensionsConfig,
	});

	if (!composerSuccess) {
		return { status: "ERROR" };
	}

	return {
		status: "CHANGED",
		runUpdatePhp,
	};
};

export default doExtensions;

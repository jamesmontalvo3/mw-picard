import path from "path";
import { promises as fsp } from "fs";
import { asyncRimraf } from "./asyncRimraf";
import { asyncExec } from "./asyncExec";
import propsMatch from "./propsMatch";
import difference from "lodash/difference";
import deepEqual from "lodash/isEqual";

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

export const shouldRunUpdatePhp = (
	newConf: ExtensionConfig,
	oldConf?: ExtensionConfig
): boolean | string[] => {
	if (!newConf.update_php_on_change) {
		return false;
	}
	if (!oldConf) {
		return true;
	}

	const propsToCheck =
		newConf.update_php_on_change === "code-changes"
			? codeProps
			: [...codeProps, ...confProps];

	const extensionIsUnchanged = propsMatch(newConf, oldConf, propsToCheck);

	const oldWikiConf = oldConf.wikis || [];
	const newWikiConf = newConf.wikis || [];

	if (extensionIsUnchanged) {
		const newWikis = difference(oldWikiConf, newWikiConf);
		if (newWikis.length === 0) {
			return false;
		}
		return newWikis; // array of wiki IDs requiring update
	}
	return true;
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
	let extensionSettings =
		"<?php\n\n/**\n * This file is automatically generated by mw-picard\n */\n\n";
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
		if (!Array.isArray(result)) {
			runUpdatePhp = result; // (a) keep as false or (b) set to true and break on next pass
			continue;
		}

		runUpdatePhp = Array.isArray(runUpdatePhp)
			? [...runUpdatePhp, ...result] // add to existing array of wikis
			: result;
	}

	await doExtensionSettings({ extensionsPath, extensionsConfig });

	await doComposerExtensions({
		mediawikiPath,
		composerCmd,
		extensions: extensionsConfig,
	});

	return {
		status: "CHANGED",
		runUpdatePhp,
	};
};

export default doExtensions;

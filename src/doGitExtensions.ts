import path from "path";
import { promises as fsp } from "fs";
import asyncRimraf from "./asyncRimraf";
import asyncExec from "./asyncExec";
import propsMatch from "./propsMatch";
import { difference } from "lodash";

const codeProps = ["name", "version", "composer", "repo", "skin"];
const confProps = ["config", "more_config"];

export const shouldUpdateExtension = (
	newConf: ExtensionConfig,
	oldConf: ExtensionConfig | undefined
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
	oldConf: ExtensionConfig | undefined
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
	const newWikis = difference(newConf.wikis || [], oldConf.wikis || []);

	if (extensionIsUnchanged) {
		if (newWikis.length === 0) {
			return false;
		}
		return newWikis; // array of wiki IDs requiring update
	}
	return true;
};

const createLoadCommand = (
	ext: ExtensionConfig,
	cloneDirectory: string
): string => {
	if ("composer" in ext) {
		return ""; // Not all Composer extensions require loading
	} else if (ext.legacy_load) {
		return `require_once '${cloneDirectory}';\n`;
	}

	return ext.skin
		? `wfLoadSkin( "${ext.name}" );\n`
		: `wfLoadExtension( "${ext.name}" );\n`;
};

const createExtensionSettings = (
	ext: ExtensionConfig,
	cloneDirectory: string
): string => {
	const commentHeader = `/**** ${ext.name} @ ${ext.version} ****/\n`;

	const config = ext.config ? ext.config + "\n" : "";
	const moreConfig = ext.more_config ? ext.more_config + "\n" : "";

	const conf = createLoadCommand(ext, cloneDirectory) + config + moreConfig;

	if (ext.wikis) {
		const wikisPhpArray = "[" + ext.wikis.map((w) => `'${w}'`).join(", ") + "]";
		const indentedConf = conf.replace(/\n/gi, "\n\t");
		return `if ( in_array( $wikiId, ${wikisPhpArray} ) ) {\n${indentedConf}\n}\n\n`;
	} else {
		return commentHeader + conf + "\n\n";
	}
};

const isGitRepo = async (dir: string): Promise<boolean> => {
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

type GitCloneProps = {
	cloneDirectory: string;
	repo: string;
	version: string;
};

const getGitSetHeadCmd = ({
	cloneDirectory,
	version,
	fetch,
	eraseChanges,
}: GitCloneProps & { fetch: boolean; eraseChanges: boolean }): string => {
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

const gitClone = async ({
	cloneDirectory,
	repo,
	version,
}: GitCloneProps): "a return" => {
	const parentDir = path.dirname(cloneDirectory);
	const repoDirname = path.basename(cloneDirectory);
	const { stdout, stderr } = await asyncExec(
		`cd ${parentDir} && git clone ${repo} ./${repoDirname} && ` +
			getGitSetHeadCmd({
				cloneDirectory,
				repo,
				version,
				fetch: false,
				eraseChanges: true,
			})
	);
};

const makeGitRight = async (props: GitCloneProps): Promise<boolean> => {
	const { cloneDirectory, repo, version } = props;
	if (await isGitRepo(cloneDirectory)) {
		const { stdout, stderr } = await asyncExec(
			getGitSetHeadCmd({
				...props,
				fetch: true,
				eraseChanges: true,
			})
		);
	} else {
		gitClone(props);
	}
};

const doExtensions = ({
	extensionsPath,
	skinsPath,
	extensionsConfig,
	priorExtensions,
}: {
	extensionsPath: string;
	skinsPath: string;
	extensionsConfig: ExtensionConfig[];
	priorExtensions: ExtensionConfigMap;
}): "made up return" => {
	let runUpdatePhp: boolean | string[] = false;

	for (const ext of extensionsConfig) {
		if ("composer" in ext) {
			continue; // this function handles git-managed extensions, not composer managed
		}
		if (!shouldUpdateExtension(ext, priorExtensions[ext.name])) {
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
	}

	for (const ext of extensionsConfig) {
		if ("repo" in ext) {
			continue; // fixme also do whatever needs doing for composer_merge?
		}
		if (!shouldUpdateExtension(ext, priorExtensions[ext.name])) {
			continue;
		}
		const cloneDirectory = path.join(
			ext.skin ? skinsPath : extensionsPath,
			ext.name
		);
		const success = await makeComposerDoingOf({
			cloneDirectory,
			composer: ext.composer,
			version: ext.version,
		});
		if (success) {
		} else {
			// fixme err?
		}
	}

	for (const ext of extensionsConfig) {
		if (runUpdatePhp === true) {
			break; // if it's already set to run for all wikis, no reason to check any more
		}

		const result = shouldRunUpdatePhp(ext, priorExtensions[ext.name]);
		if (!Array.isArray(result)) {
			runUpdatePhp = result; // (a) keep as false or (b) set to true and break on next pass
			continue;
		}

		runUpdatePhp = Array.isArray(runUpdatePhp)
			? [...runUpdatePhp, ...result] // add to existing array of wikis
			: result;
	}

	let extensionSettings =
		"<?php\n\n/**\n * This file is automatically generated by mw-picard\n */\n\n";
	for (const ext of extensionsConfig) {
		const cloneDirectory = path.join(
			ext.skin ? skinsPath : extensionsPath,
			ext.name
		);
		extensionSettings += createExtensionSettings(ext, cloneDirectory);
	}

	return {
		extensionSettings,
		runUpdatePhp,
	};
};

// FIXME file rename
export default doExtensions;

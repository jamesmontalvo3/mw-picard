import path from "path";
import { promises as fsp } from "fs";
import asyncRimraf from "./asyncRimraf";
import asyncExec from "./asyncExec";

const propsMatch = (
	obj1: Record<string, unknown>,
	obj2: Record<string, unknown>,
	props: string[]
): boolean => {
	for (const prop of props) {
		if (obj1[prop] !== obj2[prop]) {
			return false;
		}
	}
	return true;
};

const shouldUpdateExtension = (
	newConf: ExtensionConfig,
	oldConf: ExtensionConfig | undefined
): boolean => {
	if (!oldConf) {
		return true;
	}
	if (
		!propsMatch(newConf, oldConf, [
			"name",
			"version",
			"composer",
			"repo",
			"skin",
		])
	) {
		return false;
	}
	return true;
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

const doGitExtensions = ({
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
		makeGitRight({
			cloneDirectory,
			repo: ext.repo,
			version: ext.version,
		});
	}
	return false;
};

export default doGitExtensions;

import fs, { promises as fsp } from "fs";

// fixme in new commit replace `it("should ` with ``

import path from "path";
import * as asyncExecModule from "./asyncExec";
import * as asyncRimrafModule from "./asyncRimraf";
import {
	composerLocalJsonify,
	createExtensionSettings,
	createLoadCommand,
	doComposerExtensions,
	gitCheckoutCommand,
	isGitRepo,
	makeGitRight,
	shouldRunUpdatePhp,
	shouldUpdateExtension,
} from "./doExtensions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeAsyncRimrafSpy = (mock: (...args: any) => any) => {
	return (
		jest
			.spyOn(asyncRimrafModule, "asyncRimraf")
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.mockImplementation(mock)
	);
};

const makeAsyncExecSpy = ({ throws }: { throws: boolean }) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const mock: any = throws
		? async (cmd: string) => {
				throw new Error("Testing intensional throw for " + cmd);
		  }
		: async (cmd: string) => {
				return "Mock run of command " + cmd;
		  };
	return jest.spyOn(asyncExecModule, "asyncExec").mockImplementation(mock);
};

describe("shouldUpdateExtension()", () => {
	it("should update extension if props change", () => {
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://git.example.com/MyExtension",
				}
			)
		).toEqual(true);
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyExtension",
					version: "1.2.5",
					repo: "https://example.com/MyExtension",
				}
			)
		).toEqual(true);
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					composer: "my/extension",
				}
			)
		).toEqual(true);
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyNewlyNamedExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				}
			)
		).toEqual(true);
	});

	it("should not update extension if props don't change", () => {
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki"],
				}
			)
		).toEqual(false);
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "config 11111",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "config 222222",
				}
			)
		).toEqual(false);
	});

	it("should update extension if no old conf", () => {
		expect(
			shouldUpdateExtension({
				name: "MyExtension",
				version: "1.2.3",
				repo: "https://example.com/MyExtension",
			})
		).toEqual(true);
	});
});

describe("shouldRunUpdatePhp()", () => {
	it("should run update.php if props change", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "all",
				},
				{
					name: "MyExtension",
					version: "1.2.4",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "all",
				}
			)
		).toEqual(true);
	});
	it("should never require update.php if update_php_on_change is false", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: false,
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "SomethingElse",
					version: "10.1231.42345345",
					repo: "https://SOMETHINGELSE.example.com/MyExtension",
					config: "101111011011100001010101",
					more_config: "42",
					composer_merge: false,
					git_submodules: false,
					legacy_load: false,
					update_php_on_change: false,
					wikis: ["threewiki"],
				}
			)
		).toEqual(false);
	});
	it("should not run update.php if props don't change", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "all",
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "all",
					wikis: ["onewiki", "twowiki"],
				}
			)
		).toEqual(false);
	});
	it("should not run update.php if only config change and extension states 'code-changes'", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "this line has changed",
					more_config: "and so has this one",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki"],
				}
			)
		).toEqual(false);
	});
	it("should run update.php if no old conf and extension requires update.php", () => {
		expect(
			shouldRunUpdatePhp({
				name: "MyExtension",
				version: "1.2.3",
				repo: "https://example.com/MyExtension",
				config: "asdfasdf",
				more_config: "asdf",
				composer_merge: true,
				git_submodules: true,
				legacy_load: true,
				update_php_on_change: "code-changes",
				wikis: ["onewiki", "twowiki"],
			})
		).toEqual(true);
	});
	it("should not run update.php if no old conf and extension does not require update.php", () => {
		expect(
			shouldRunUpdatePhp({
				name: "MyExtension",
				version: "1.2.3",
				repo: "https://example.com/MyExtension",
				config: "asdfasdf",
				more_config: "asdf",
				composer_merge: true,
				git_submodules: true,
				legacy_load: true,
				update_php_on_change: false,
				wikis: ["onewiki", "twowiki"],
			})
		).toEqual(false);
	});
	it("should specify which wikis to run changes on if only wikis added", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki", "threewiki"],
				}
			)
		).toEqual(["threewiki"]);
	});
	it("should not require update.php if only wikis removed", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki"],
				}
			)
		).toEqual(false);
	});
	it("should only require update.php for added wiki if one wiki added and one removed", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "threewiki"],
				}
			)
		).toEqual(["threewiki"]);
	});
	it("should be uneffected by reordering wikis", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "asdfasdf",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["twowiki", "onewiki"],
				}
			)
		).toEqual(false);
	});
	it("should handle going from all-wikis (e.g. no wikis specified) to specifying wikis", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					wikis: ["twowiki", "onewiki"],
				}
			)
		).toEqual(["twowiki", "onewiki"]);
	});
	it("should handle going from specifying wikis to all-wikis (not specifying wikis)", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					wikis: ["twowiki", "onewiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					// wikis are implicitly all now, which could include those other than one/two
				}
			)
		).toEqual(false);
	});
});

// fixme needed?
describe("createLoadCommand()", () => {
	it("should return empty string for composer extensions", () => {
		expect(
			createLoadCommand(
				{
					name: "MyExt",
					composer: "group/ext",
					version: "1.2.3.",
				},
				"/path/to/extension"
			)
		).toEqual("");
	});
	it("should return require_once for legacy load", () => {
		expect(
			createLoadCommand(
				{
					name: "MyExt",
					repo: "https://git.example.com",
					version: "1.2.3.",
					legacy_load: true,
				},
				"/path/to/extension"
			)
		).toEqual("require_once '/path/to/extension';\n");
	});
	it("should use extension loader for normal extensions", () => {
		expect(
			createLoadCommand(
				{
					name: "MyExt",
					repo: "https://git.example.com",
					version: "1.2.3.",
				},
				"/path/to/extension"
			)
		).toEqual('wfLoadExtension( "MyExt" );\n');
	});
	it("should use extension loader for normal skins", () => {
		expect(
			createLoadCommand(
				{
					name: "MyExt",
					repo: "https://git.example.com",
					version: "1.2.3.",
					skin: true,
				},
				"/path/to/extension"
			)
		).toEqual('wfLoadSkin( "MyExt" );\n');
	});
});

describe("createExtensionSettings()", () => {
	it("should produce settings for normal extension", () => {
		expect(
			createExtensionSettings(
				{
					name: "MyExt",
					repo: "https://git.example.com",
					version: "1.2.3",
					config: "$wgMyExtVar = 42;",
					more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
				},
				"/path/to/ext"
			)
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
wfLoadExtension( "MyExt" );
$wgMyExtVar = 42;
$wgMyExtVar2 = 'test';
$wgMyExtVar3 = [];

`
		);
	});

	it("should produce settings for normal skin", () => {
		expect(
			createExtensionSettings(
				{
					name: "MyExt",
					repo: "https://git.example.com",
					version: "1.2.3",
					skin: true,
					config: "$wgMyExtVar = 42;",
					more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
				},
				"/path/to/ext"
			)
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
wfLoadSkin( "MyExt" );
$wgMyExtVar = 42;
$wgMyExtVar2 = 'test';
$wgMyExtVar3 = [];

`
		);
	});

	it("should produce settings for composer extension", () => {
		expect(
			createExtensionSettings(
				{
					name: "MyExt",
					composer: "group/extension",
					version: "1.2.3",
					config: "$wgMyExtVar = 42;",
					more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
				},
				"/path/to/ext"
			)
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
$wgMyExtVar = 42;
$wgMyExtVar2 = 'test';
$wgMyExtVar3 = [];

`
		);
	});

	it("should produce settings for legacy-load extension", () => {
		expect(
			createExtensionSettings(
				{
					name: "MyExt",
					repo: "https://git.example.com",
					legacy_load: true,
					version: "1.2.3",
					config: "$wgMyExtVar = 42;",
					more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
				},
				"/path/to/ext"
			)
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
require_once '/path/to/ext';
$wgMyExtVar = 42;
$wgMyExtVar2 = 'test';
$wgMyExtVar3 = [];

`
		);
	});

	it("should produce settings without config", () => {
		expect(
			createExtensionSettings(
				{
					name: "MyExt",
					repo: "https://git.example.com",
					version: "1.2.3",
					more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
				},
				"/path/to/ext"
			)
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
wfLoadExtension( "MyExt" );
$wgMyExtVar2 = 'test';
$wgMyExtVar3 = [];

`
		);
	});

	it("should produce settings without more_config", () => {
		expect(
			createExtensionSettings(
				{
					name: "MyExt",
					repo: "https://git.example.com",
					version: "1.2.3",
					config: "$wgMyExtVar = 42;",
				},
				"/path/to/ext"
			)
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
wfLoadExtension( "MyExt" );
$wgMyExtVar = 42;

`
		);
	});

	it("should produce settings without config or more_config", () => {
		expect(
			createExtensionSettings(
				{
					name: "MyExt",
					repo: "https://git.example.com",
					version: "1.2.3",
				},
				"/path/to/ext"
			)
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
wfLoadExtension( "MyExt" );

`
		);
	});

	it("should produce settings for wiki-specific extensions", () => {
		expect(
			createExtensionSettings(
				{
					name: "MyExt",
					repo: "https://git.example.com",
					version: "1.2.3",
					config: "$wgMyExtVar = 42;",
					more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
					wikis: ["onewiki", "twowiki"],
				},
				"/path/to/ext"
			)
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
if ( in_array( $wikiId, ['onewiki', 'twowiki'] ) ) {
	wfLoadExtension( "MyExt" );
	$wgMyExtVar = 42;
	$wgMyExtVar2 = 'test';
	$wgMyExtVar3 = [];
}

`
		);
	});
});

describe("isGitRepo()", () => {
	beforeAll(() => {
		jest
			.spyOn(fsp, "access")
			.mockImplementation(async (lookupPath: string | Buffer | URL) => {
				if (typeof lookupPath !== "string") {
					throw new Error("this test is only for strings");
				}
				const existingPaths: string[] = [
					"/is/git/repo",
					"/is/git/repo/.git",
					"/not/git/repo",
				].map((p) => path.join(p));
				if (!existingPaths.includes(path.join(lookupPath))) {
					throw new Error("Path not found");
				}
			});
		makeAsyncRimrafSpy(() => async () => undefined);
	});
	it("should fail if path doesn't exist", async () => {
		const result = await isGitRepo("/path/does/not/exist");
		expect(result).toEqual(false);
	});
	it("should fail if doesn't have .git/ sub-directory", async () => {
		expect(await isGitRepo("/not/git/repo")).toEqual(false);
	});
	it("should return true if path exists and has .git/ sub-directory", async () => {
		expect(await isGitRepo("/is/git/repo")).toEqual(true);
	});
	afterAll(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});
});

describe("gitCheckoutCommand()", () => {
	it("should create command that fetches and cleans up repo", () => {
		expect(
			gitCheckoutCommand({
				cloneDirectory: "/path/to/ext",
				version: "tags/1.2.3",
				fetch: true,
				eraseChanges: true,
			})
		).toEqual(
			"cd /path/to/ext && git fetch && git reset --hard HEAD && git clean -f && git checkout tags/1.2.3"
		);
	});
	it("should create command that fetch", () => {
		expect(
			gitCheckoutCommand({
				cloneDirectory: "/path/to/ext",
				version: "tags/1.2.3",
				fetch: true,
				eraseChanges: false,
			})
		).toEqual("cd /path/to/ext && git fetch && git checkout tags/1.2.3");
	});
	it("should create command that just cleans up repo", () => {
		expect(
			gitCheckoutCommand({
				cloneDirectory: "/path/to/ext",
				version: "tags/1.2.3",
				fetch: false,
				eraseChanges: true,
			})
		).toEqual(
			"cd /path/to/ext && git reset --hard HEAD && git clean -f && git checkout tags/1.2.3"
		);
	});
	it("should just checks out the correct version", () => {
		expect(
			gitCheckoutCommand({
				cloneDirectory: "/path/to/ext",
				version: "tags/1.2.3",
				fetch: false,
				eraseChanges: false,
			})
		).toEqual("cd /path/to/ext && git checkout tags/1.2.3");
	});
});

describe("makeGitRight()", () => {
	let consoleErrorSpy: jest.SpyInstance;

	beforeAll(() => {
		jest
			.spyOn(fsp, "access")
			.mockImplementation(async (lookupPath: string | Buffer | URL) => {
				if (typeof lookupPath !== "string") {
					throw new Error("this test is only for strings");
				}
				const existingPaths: string[] = [
					"/is/git/repo",
					"/is/git/repo/.git",
					"/not/git/repo",
				].map((p) => path.join(p));
				if (!existingPaths.includes(path.join(lookupPath))) {
					throw new Error("Path not found");
				}
			});
		makeAsyncRimrafSpy(() => async () => undefined);
	});

	beforeEach(() => {
		consoleErrorSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => jest.fn());
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it("should handle existing repo-directory with valid commands", async () => {
		const asyncExecSpy = makeAsyncExecSpy({ throws: false });

		expect(
			await makeGitRight({
				cloneDirectory: "/is/git/repo",
				repo: "https://git.example.com/MyExt",
				version: "1.2.3",
			})
		).toEqual(true);
		expect(asyncExecSpy).toHaveBeenCalledWith(
			"cd /is/git/repo && git fetch && git reset --hard HEAD && git clean -f && git checkout 1.2.3"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
	});

	it("should handle existing repo-directory with invalid commands", async () => {
		const asyncExecSpy = makeAsyncExecSpy({ throws: true });

		expect(
			await makeGitRight({
				cloneDirectory: "/is/git/repo",
				repo: "https://git.example.com/MyExt",
				version: "2.2.3",
			})
		).toEqual(false);
		expect(asyncExecSpy).toHaveBeenCalledWith(
			"cd /is/git/repo && git fetch && git reset --hard HEAD && git clean -f && git checkout 2.2.3"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});

	test("should handle missing repo-directory with valid commands", async () => {
		const asyncExecSpy = makeAsyncExecSpy({ throws: false });

		expect(
			await makeGitRight({
				cloneDirectory: "/not/git/repo",
				repo: "https://git.example.com/MyExt",
				version: "3.2.3",
			})
		).toEqual(true);
		expect(asyncExecSpy).toHaveBeenCalledWith(
			"git clone https://git.example.com/MyExt /not/git/repo && cd /not/git/repo && git checkout 3.2.3"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
	});

	it("should handle missing repo-directory with invalid commands", async () => {
		const asyncExecSpy = makeAsyncExecSpy({ throws: true });

		expect(
			await makeGitRight({
				cloneDirectory: "/not/git/repo",
				repo: "https://git.example.com/MyExt",
				version: "4.2.3",
			})
		).toEqual(false);
		expect(asyncExecSpy).toHaveBeenCalledWith(
			"git clone https://git.example.com/MyExt /not/git/repo && cd /not/git/repo && git checkout 4.2.3"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});

	// FIXME does this do anything?
	afterAll(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});
});
/*
describe("doComposerExtensions()", () => {
	// FIXME. Mocks needed
	// readfile - varies for different current composer.local.json, also throws
	// writeFile - success and failure to write
	// asyncExec - success and failure to run command

	const makeWriteFileMock = ({ throws }: { throws: boolean }) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const mock: any = throws
			? async () => {
					throw new Error("Mock: throw on fsp.writeFile()");
			  }
			: async () => undefined;
		return mock;
	};

	const makeReadFileMock = (fileContent: string | false) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const mock: any = async (...args: any[]) => {
			console.error("Mocked fsp.readFile called with args: ", args);
			if (fileContent) {
				return fileContent;
			}
			console.error("mock is throwing");
			throw new Error("Mock: no such file");
		};

		return mock;
	};

	const makeFspWriteFileSpy = ({ throws }: { throws: boolean }) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const mock: any = throws
			? async () => {
					throw new Error("Mock: throw on fsp.writeFile()");
			  }
			: async () => undefined;
		return jest.spyOn(fs.promises, "readFile").mockImplementation(mock);
	};

	const makeFspReadFileSpy = (fileContent: string | false) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const mock: any = async (...args: any[]) => {
			console.error("Mocked fsp.readFile called with args: ", args);
			if (fileContent) {
				return fileContent;
			}
			console.error("mock is throwing");
			throw new Error("Mock: no such file");
		};

		return jest.spyOn(fs.promises, "readFile").mockImplementation(mock);
	};

	//FIXME
	it("should work", async () => {
		const preexistingFile = composerLocalJsonify({
			require: {},
			extra: {
				"merge-plugin": {
					include: [],
				},
			},
		});

		jest.mock("fs", () => ({
			promises: {
				writeFile: makeWriteFileMock({ throws: false }),
				readFile: makeReadFileMock(preexistingFile),
			},
		}));
		const readFileSpy = jest.spyOn(fs.promises, "readFile");
		const writeFileSpy = jest.spyOn(fs.promises, "writeFile");
		// const readFileSpy = makeFspReadFileSpy(preexistingFile);
		// const writeFileSpy = makeFspWriteFileSpy({ throws: false });
		const asyncExecSpy = makeAsyncExecSpy({ throws: false });

		expect(
			await doComposerExtensions({
				mediawikiPath: "/path/to/mediawiki",
				composerCmd: "/path/to/composer",
				extensions: [],
			})
		).toEqual(true);
		expect(readFileSpy).toHaveBeenCalledWith(
			path.join("/path/to/mediawiki", "composer.local.json"),
			"utf-8"
		);
		expect(readFileSpy).toHaveLastReturnedWith(preexistingFile);
		expect(writeFileSpy).not.toHaveBeenCalled();
		expect(asyncExecSpy).not.toHaveBeenCalled();
	});
});

*/
/*

describe("doExtensionSettings()", () => {
	it("should work", () => { // FIXME
		expect(true).toEqual(false);
	});
});

describe("doExtensions()", () => {
	it("should work", () => { //FIXME
		expect(true).toEqual(false);
	});
});
*/

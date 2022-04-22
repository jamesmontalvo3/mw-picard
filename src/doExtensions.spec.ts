import fs, { promises as fsp } from "fs";
import path from "upath";
import * as asyncExecModule from "./asyncExec";
import doExtensions, {
	ComposerJson,
	composerLocalJsonify,
	createExtensionSettings,
	createLoadCommand,
	doComposerExtensions,
	doExtensionSettings,
	gitCheckoutCommand,
	isGitRepo,
	makeGitRight,
	shouldRunUpdatePhp,
	shouldUpdateExtension,
} from "./doExtensions";
import cloneDeep from "lodash/cloneDeep";
import {
	makeAsyncRimrafSpy,
	makeAsyncExecSpy,
	makeReadFileSpy,
	makeWriteFileSpy,
	makeConsoleErrorSpy,
} from "./test-utils";

describe("shouldUpdateExtension()", () => {
	test("update extension if props change", () => {
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

	test("not update extension if props don't change", () => {
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

	test("update extension if no old conf", () => {
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
	test("run update.php if props change", () => {
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
	test("never require update.php if update_php_on_change is false", () => {
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
	test("not run update.php if props don't change", () => {
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
	test("not run update.php if only config change and extension states 'code-changes'", () => {
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
	test("run update.php on all wikis if no old conf and extension requires update.php and is on all wikis", () => {
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
			})
		).toEqual(true);
	});
	test("run update.php on specific wikis if no old conf and extension requires update.php and is only on specific wikis", () => {
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
		).toEqual(["onewiki", "twowiki"]);
	});
	test("not run update.php if no old conf and extension does not require update.php", () => {
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
	test("specify which wikis to run changes on if only wikis added", () => {
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
	test("not require update.php if only wikis removed", () => {
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
	test("only require update.php for added wiki if one wiki added and one removed", () => {
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
	test("be uneffected by reordering wikis", () => {
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
	test("handle going from specifying wikis to all-wikis (not specifying wikis)", () => {
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
	test("only update specified wikis if the wiki's version updates", () => {
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
					version: "1.2.4",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					wikis: ["twowiki", "onewiki"],
				}
			)
		).toEqual(["twowiki", "onewiki"]);
	});

	// Ref the docs for shouldRunUpdatePhp() for what the following comments mean
	// Unchanged extension:
	// Case 1: should not-update.php       if no-change AND all-wikis-before AND all-wikis-now
	// Case 2: should not-update.php       if no-change AND all-wikis-before AND select-wikis-now
	// Case 3: should update.php-all       if no-change AND select-wikis-before AND all-wikis-now
	// Case 4: should update.php-new-wikis if no-change AND select-wikis-before AND select-wikis-now
	// Changed extension:
	// Case 5: should update.php-all       if changed AND all-wikis-before AND all-wikis-now
	// Case 6: should update.php-now-wikis if changed AND all-wikis-before AND select-wikis-now
	// Case 7: should update.php-all       if changed AND select-wikis-before AND all-wikis-now
	// Case 8: should update.php-now-wikis if changed AND select-wikis-before AND select-wikis-now
	test("handle case 1: don't update.php if no-change AND all-wikis-before and all-wikis-now", () => {
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
				}
			)
		).toEqual(false);
	});
	test("handle case 2: don't update.php if no-change AND all-wikis-before and select-wikis-now", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
				}
			)
		).toEqual(false);
	});
	test("handle case 3: update.php-for-all if no-change AND select-wikis-before and all-wikis-now", () => {
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
					wikis: ["onewiki", "twowiki"],
				}
			)
		).toEqual(true);
	});
	test("handle case 4: update.php-for-NEW-wikis if no-change AND select-wikis-before and select-wikis-now", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "threewiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki"],
				}
			)
		).toEqual(["twowiki"]);
	});
	test("handle case 5: update.php-for-all if changed AND all-wikis-before and all-wikis-now", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.5",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
				}
			)
		).toEqual(true);
	});
	test("handle case 6: update.php-for-NOW-wikis if changed AND all-wikis-before and select-wikis-now", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.5",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "threewiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
				}
			)
		).toEqual(["onewiki", "threewiki"]);
	});
	test("handle case 7: update.php-for-all if changed AND select-wikis-before and all-wikis-now", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.5",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "threewiki"],
				}
			)
		).toEqual(true);
	});
	test("handle case 8: update.php-for-NOW-wikis if changed AND select-wikis-before and select-wikis-now", () => {
		expect(
			shouldRunUpdatePhp(
				{
					name: "MyExtension",
					version: "1.2.5",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					wikis: ["twowiki", "threewiki", "fivewiki"],
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "threewiki"],
				}
			)
		).toEqual(["twowiki", "threewiki", "fivewiki"]);
	});
});

describe("createLoadCommand()", () => {
	test("return empty string for composer extensions", () => {
		expect(
			createLoadCommand({
				name: "MyExt",
				composer: "group/ext",
				version: "1.2.3.",
			})
		).toEqual("");
	});
	test("return require_once for legacy loaded extension", () => {
		expect(
			createLoadCommand({
				name: "MyExt",
				repo: "https://git.example.com",
				version: "1.2.3.",
				legacy_load: true,
			})
		).toEqual("require_once '$IP/extensions/MyExt/MyExt.php';\n");
	});
	test("return require_once for legacy loaded skin", () => {
		expect(
			createLoadCommand({
				name: "MySkin",
				repo: "https://git.example.com",
				version: "1.2.3.",
				legacy_load: true,
				skin: true,
			})
		).toEqual("require_once '$IP/skins/MySkin/MySkin.php';\n");
	});
	test("use extension loader for normal extensions", () => {
		expect(
			createLoadCommand({
				name: "MyExt",
				repo: "https://git.example.com",
				version: "1.2.3.",
			})
		).toEqual('wfLoadExtension( "MyExt" );\n');
	});
	test("use extension loader for normal skins", () => {
		expect(
			createLoadCommand({
				name: "MyExt",
				repo: "https://git.example.com",
				version: "1.2.3.",
				skin: true,
			})
		).toEqual('wfLoadSkin( "MyExt" );\n');
	});
});

describe("createExtensionSettings()", () => {
	test("produce settings for normal extension", () => {
		expect(
			createExtensionSettings({
				name: "MyExt",
				repo: "https://git.example.com",
				version: "1.2.3",
				config: "$wgMyExtVar = 42;",
				more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
			})
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
wfLoadExtension( "MyExt" );
$wgMyExtVar = 42;
$wgMyExtVar2 = 'test';
$wgMyExtVar3 = [];

`
		);
	});

	test("produce settings for normal skin", () => {
		expect(
			createExtensionSettings({
				name: "MyExt",
				repo: "https://git.example.com",
				version: "1.2.3",
				skin: true,
				config: "$wgMyExtVar = 42;",
				more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
			})
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
wfLoadSkin( "MyExt" );
$wgMyExtVar = 42;
$wgMyExtVar2 = 'test';
$wgMyExtVar3 = [];

`
		);
	});

	test("produce settings for composer extension", () => {
		expect(
			createExtensionSettings({
				name: "MyExt",
				composer: "group/extension",
				version: "1.2.3",
				config: "$wgMyExtVar = 42;",
				more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
			})
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
$wgMyExtVar = 42;
$wgMyExtVar2 = 'test';
$wgMyExtVar3 = [];

`
		);
	});

	test("produce settings for legacy-load extension", () => {
		expect(
			createExtensionSettings({
				name: "MyExt",
				repo: "https://git.example.com",
				legacy_load: true,
				version: "1.2.3",
				config: "$wgMyExtVar = 42;",
				more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
			})
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
require_once '$IP/extensions/MyExt/MyExt.php';
$wgMyExtVar = 42;
$wgMyExtVar2 = 'test';
$wgMyExtVar3 = [];

`
		);
	});

	test("produce settings without config", () => {
		expect(
			createExtensionSettings({
				name: "MyExt",
				repo: "https://git.example.com",
				version: "1.2.3",
				more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
			})
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
wfLoadExtension( "MyExt" );
$wgMyExtVar2 = 'test';
$wgMyExtVar3 = [];

`
		);
	});

	test("produce settings without more_config", () => {
		expect(
			createExtensionSettings({
				name: "MyExt",
				repo: "https://git.example.com",
				version: "1.2.3",
				config: "$wgMyExtVar = 42;",
			})
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
wfLoadExtension( "MyExt" );
$wgMyExtVar = 42;

`
		);
	});

	test("produce settings without config or more_config", () => {
		expect(
			createExtensionSettings({
				name: "MyExt",
				repo: "https://git.example.com",
				version: "1.2.3",
			})
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
wfLoadExtension( "MyExt" );

`
		);
	});

	test("produce settings for wiki-specific extensions", () => {
		expect(
			createExtensionSettings({
				name: "MyExt",
				repo: "https://git.example.com",
				version: "1.2.3",
				config: "$wgMyExtVar = 42;",
				more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
				wikis: ["onewiki", "twowiki"],
			})
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

	test("produce settings for empty wikis (clones extension but no wikis use)", () => {
		expect(
			createExtensionSettings({
				name: "MyExt",
				repo: "https://git.example.com",
				version: "1.2.3",
				config: "$wgMyExtVar = 42;",
				more_config: "$wgMyExtVar2 = 'test';\n$wgMyExtVar3 = [];",
				wikis: [],
			})
		).toEqual(
			`/**** MyExt @ 1.2.3 ****/
if ( in_array( $wikiId, [] ) ) {
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
	let asyncRimrafSpy: jest.SpyInstance;
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
	});

	test("fail if path doesn't exist", async () => {
		asyncRimrafSpy = makeAsyncRimrafSpy({ throws: false });
		const result = await isGitRepo("/path/does/not/exist");
		expect(result).toEqual(false);
	});
	test("fail if doesn't have .git/ sub-directory", async () => {
		asyncRimrafSpy = makeAsyncRimrafSpy({ throws: false });
		expect(await isGitRepo("/not/git/repo")).toEqual(false);
	});
	test("return true if path exists and has .git/ sub-directory", async () => {
		asyncRimrafSpy = makeAsyncRimrafSpy({ throws: false });
		expect(await isGitRepo("/is/git/repo")).toEqual(true);
	});
	test("throw if unable to delete existing non-git directory", async () => {
		const consoleErrorSpy = makeConsoleErrorSpy();
		asyncRimrafSpy = makeAsyncRimrafSpy({ throws: true });
		await expect(async () => {
			await isGitRepo("/not/git/repo");
		}).rejects.toThrow();
		expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
		consoleErrorSpy.mockRestore();
		consoleErrorSpy.mockClear();
	});

	afterEach(() => {
		asyncRimrafSpy.mockRestore();
		asyncRimrafSpy.mockClear();
	});
	afterAll(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});
});

describe("gitCheckoutCommand()", () => {
	test("create command that fetches and cleans up repo", () => {
		expect(
			gitCheckoutCommand({
				version: "tags/1.2.3",
				fetch: true,
				eraseChanges: true,
			})
		).toEqual(
			"cd /path/to/ext && git fetch && git reset --hard HEAD && git clean -f && git checkout tags/1.2.3"
		);
	});
	test("create command that fetch", () => {
		expect(
			gitCheckoutCommand({
				version: "tags/1.2.3",
				fetch: true,
				eraseChanges: false,
			})
		).toEqual("cd /path/to/ext && git fetch && git checkout tags/1.2.3");
	});
	test("create command that just cleans up repo", () => {
		expect(
			gitCheckoutCommand({
				version: "tags/1.2.3",
				fetch: false,
				eraseChanges: true,
			})
		).toEqual(
			"cd /path/to/ext && git reset --hard HEAD && git clean -f && git checkout tags/1.2.3"
		);
	});
	test("just checks out the correct version", () => {
		expect(
			gitCheckoutCommand({
				version: "tags/1.2.3",
				fetch: false,
				eraseChanges: false,
			})
		).toEqual("cd /path/to/ext && git checkout tags/1.2.3");
	});
});

describe("makeGitRight()", () => {
	let consoleErrorSpy: jest.SpyInstance;
	let asyncRimrafSpy: jest.SpyInstance;

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
		asyncRimrafSpy = makeAsyncRimrafSpy({ throws: false });
	});

	beforeEach(() => {
		consoleErrorSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => jest.fn());
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		asyncRimrafSpy.mockRestore();
	});

	test("handle existing repo-directory with valid commands", async () => {
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

	test("handle existing repo-directory with invalid commands", async () => {
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

	test("handle missing repo-directory with invalid commands", async () => {
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

	test("handle non-git repo when insufficient rights to delete directory", async () => {
		const asyncExecSpy = makeAsyncExecSpy({ throws: true });

		// override the default one
		asyncRimrafSpy.mockRestore();
		asyncRimrafSpy = makeAsyncRimrafSpy({ throws: true });

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

	afterAll(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});
});

describe("doComposerExtensions()", () => {
	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	const baselineComposerLocalJson: ComposerJson = {
		require: {},
		extra: {
			"merge-plugin": {
				include: [],
			},
		},
	};

	test("not replace baseline composer.local.json if no change", async () => {
		const cLocalJsonPath = path.join(
			"/path/to/mediawiki",
			"composer.local.json"
		);

		const readFileSpy = makeReadFileSpy(
			composerLocalJsonify(baselineComposerLocalJson)
		);
		const writeFileSpy = makeWriteFileSpy({ throws: false });
		const asyncExecSpy = makeAsyncExecSpy({ throws: false });

		expect(
			await doComposerExtensions({
				appMediawikiPath: "/path/to/mediawiki",
				controllerComposerCmd: "/path/to/composer",
				extensions: [],
			})
		).toEqual(true);
		expect(readFileSpy).toHaveBeenCalledWith(cLocalJsonPath, "utf-8");
		expect(writeFileSpy).not.toHaveBeenCalled();
		expect(asyncExecSpy).not.toHaveBeenCalled();
	});

	test("replace baseline composer.local.json if changed", async () => {
		const cLocalJsonPath = path.join(
			"/path/to/mediawiki",
			"composer.local.json"
		);

		const readFileSpy = makeReadFileSpy("{}"); // initial composer.local.json is empty obj
		const writeFileSpy = makeWriteFileSpy({ throws: false });
		const asyncExecSpy = makeAsyncExecSpy({ throws: false });

		expect(
			await doComposerExtensions({
				appMediawikiPath: "/path/to/mediawiki",
				controllerComposerCmd: "/path/to/composer",
				extensions: [],
			})
		).toEqual(true);
		expect(readFileSpy).toHaveBeenCalledWith(cLocalJsonPath, "utf-8");
		expect(writeFileSpy).toHaveBeenCalledWith(
			cLocalJsonPath,
			composerLocalJsonify(baselineComposerLocalJson)
		);
		expect(asyncExecSpy).toHaveBeenCalledWith(
			"cd /path/to/mediawiki && /path/to/composer install && /path/to/composer update"
		);
	});

	test("write baseline composer.local.json if no preexisting file", async () => {
		const readFileSpy = makeReadFileSpy(false);
		const writeFileSpy = makeWriteFileSpy({ throws: false });
		const asyncExecSpy = makeAsyncExecSpy({ throws: false });

		const cLocalJsonPath = path.join(
			"/path/to/mediawiki",
			"composer.local.json"
		);

		const result = await doComposerExtensions({
			appMediawikiPath: "/path/to/mediawiki",
			controllerComposerCmd: "/path/to/composer",
			extensions: [],
		});

		expect(result).toEqual(true);
		expect(readFileSpy).toHaveBeenCalledWith(cLocalJsonPath, "utf-8");
		expect(writeFileSpy).toHaveBeenCalledWith(
			cLocalJsonPath,
			composerLocalJsonify(baselineComposerLocalJson)
		);
		expect(asyncExecSpy).toHaveBeenCalledWith(
			"cd /path/to/mediawiki && /path/to/composer install && /path/to/composer update"
		);
	});

	test("return false if unable to write file", async () => {
		const cleanMediawikiPath = path.join("/path/to/mediawiki");
		const cLocalJsonPath = path.join(cleanMediawikiPath, "composer.local.json");

		const readFileSpy = makeReadFileSpy("{}");
		const writeFileSpy = makeWriteFileSpy({ throws: true });

		const asyncExecSpy = makeAsyncExecSpy({ throws: false });

		const result = await doComposerExtensions({
			appMediawikiPath: "/path/to/mediawiki",
			controllerComposerCmd: "/path/to/composer",
			extensions: [],
		});

		expect(result).toEqual(false);
		expect(readFileSpy).toHaveBeenCalledWith(cLocalJsonPath, "utf-8");
		expect(writeFileSpy).toHaveBeenCalledWith(
			cLocalJsonPath,
			composerLocalJsonify(baselineComposerLocalJson)
		);
		expect(asyncExecSpy).not.toHaveBeenCalled();
	});

	test("add composer and composer-merge extensions", async () => {
		const cLocalJsonPath = path.join(
			"/path/to/mediawiki",
			"composer.local.json"
		);

		const composerLocalJson = cloneDeep(baselineComposerLocalJson);
		composerLocalJson.require["somegroup/someext"] = "1.2.3";
		composerLocalJson.extra["merge-plugin"].include.push(
			"extensions/AnotherExt/composer.json",
			"skins/SomeSkin/composer.json"
		);

		const readFileSpy = makeReadFileSpy("{}"); // initial composer.local.json is empty obj
		const writeFileSpy = makeWriteFileSpy({ throws: false });
		const asyncExecSpy = makeAsyncExecSpy({ throws: false });

		expect(
			await doComposerExtensions({
				appMediawikiPath: "/path/to/mediawiki",
				controllerComposerCmd: "/path/to/composer",
				extensions: [
					{
						name: "someext",
						composer: "somegroup/someext",
						version: "1.2.3",
					},
					{
						name: "AnotherExt",
						repo: "https://git.example.com/AnotherExt.git",
						version: "3.4.5",
						composer_merge: true,
					},
					{
						name: "SomeSkin",
						repo: "https://git.example.com/SomeSkin.git",
						version: "3.4.5",
						composer_merge: true,
						skin: true,
					},
				],
			})
		).toEqual(true);
		expect(readFileSpy).toHaveBeenCalledWith(cLocalJsonPath, "utf-8");
		expect(writeFileSpy).toHaveBeenCalledWith(
			cLocalJsonPath,
			composerLocalJsonify(composerLocalJson)
		);
		expect(asyncExecSpy).toHaveBeenCalledWith(
			"cd /path/to/mediawiki && /path/to/composer install && /path/to/composer update"
		);
	});
});

describe("doExtensionSettings()", () => {
	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	test("write ExtensionSettings.php", async () => {
		const writeTo = { written: "" };
		makeWriteFileSpy({ throws: false, writeTo });
		expect(
			await doExtensionSettings({
				extensionsPath: "/path/to/mw/extensions",
				extensionsConfig: [
					{
						name: "MyExt",
						repo: "https://git.example.com/MyExt.git",
						version: "1.2.3",
					},
					{
						name: "MyExt2",
						repo: "https://git.example.com/MyExt2.git",
						version: "1.2.3",
						config: "$configThing = 1;\n$configThing2 = 'two';",
					},
					{
						name: "ComposerExt",
						composer: "group/ComposerExt",
						version: "1.2.3",
					},
				],
			})
		).toEqual(true);
		expect(writeTo.written).toEqual(`<?php

/**
 * This file is automatically generated by mw-picard vTBD
 */

/**** MyExt @ 1.2.3 ****/
wfLoadExtension( "MyExt" );

/**** MyExt2 @ 1.2.3 ****/
wfLoadExtension( "MyExt2" );
$configThing = 1;
$configThing2 = 'two';

/**** ComposerExt @ 1.2.3 ****/

`);
	});

	test("return false and console.error if unable to write ExtensionSettings.php", async () => {
		const writeFileSpy = makeWriteFileSpy({ throws: true });
		const consoleErrorSpy = jest
			.spyOn(console, "error")
			.mockImplementation(jest.fn());

		expect(
			await doExtensionSettings({
				extensionsPath: "/path/to/mw/extensions",
				extensionsConfig: [
					{
						name: "MyExt",
						repo: "https://git.example.com/MyExt.git",
						version: "1.2.3",
					},
					{
						name: "MyExt2",
						repo: "https://git.example.com/MyExt2.git",
						version: "1.2.3",
						config: "$configThing = 1;\n$configThing2 = 'two';",
					},
					{
						name: "ComposerExt",
						composer: "group/ComposerExt",
						version: "1.2.3",
					},
				],
			})
		).toEqual(false);
		expect(writeFileSpy).toHaveBeenCalledTimes(1);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});
});

describe("doExtensions()", () => {
	beforeAll(() => {
		makeReadFileSpy("{}");
		makeWriteFileSpy({ throws: false });
		makeAsyncExecSpy({ throws: false });
	});

	test("handle empty config and no prior install", async () => {
		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [],
			priorInstallation: false,
		});

		expect(result).toEqual({ status: "CHANGED", runUpdatePhp: false });
	});

	test("handle empty config and empty prior install", async () => {
		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [],
			priorInstallation: [],
		});

		expect(result).toEqual({ status: "NOCHANGE" });
	});

	test("write first real config and inform to run update.php", async () => {
		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt.git",
					version: "1.2.3",
					config: "this line has changed",
					more_config: "and so has this one",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes",
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExt2",
					repo: "https://git.example.com/MyExt2.git",
					version: "1.2.3",
					config: "$configThing = 1;\n$configThing2 = 'two';",
				},
				{
					name: "ComposerExt",
					composer: "group/ComposerExt",
					version: "1.2.3",
				},
			],
			priorInstallation: [],
		});

		expect(result).toEqual({
			status: "CHANGED",
			runUpdatePhp: ["onewiki", "twowiki"],
		});
	});

	test("overwrite config and inform to run update.php", async () => {
		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt.git",
					version: "1.2.4",
					config: "this line has changed",
					more_config: "and so has this one",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes", // only required for version/repo changes
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExt2",
					repo: "https://git.example.com/MyExt2.git",
					version: "1.2.3",
					config: "$configThing = 1;\n$configThing2 = 'two';",
				},
				{
					name: "ComposerExt",
					composer: "group/ComposerExt",
					version: "1.2.3",
				},
			],
			priorInstallation: [
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt.git",
					version: "1.2.3",
					config: "this line has changed",
					more_config: "and so has this one",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "code-changes", // only required for version/repo changes
					wikis: ["onewiki", "twowiki", "threewiki"],
				},
				{
					name: "MyExt2",
					repo: "https://git.example.com/MyExt2.git",
					version: "1.2.3",
					config: "$configThing = 1;\n$configThing2 = 'two';",
				},
				{
					name: "ComposerExt",
					composer: "group/ComposerExt",
					version: "1.2.3",
				},
			],
		});

		expect(result).toEqual({
			status: "CHANGED",
			runUpdatePhp: ["onewiki", "twowiki"],
		});
	});

	test("overwrite config and inform to run update.php for added wiki when extension requires it", async () => {
		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt.git",
					version: "1.2.3",
					config: "this line has changed",
					more_config: "and so has this one",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "all",
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExt2",
					repo: "https://git.example.com/MyExt2.git",
					version: "1.2.3",
					config: "$configThing = 1;\n$configThing2 = 'two';",
				},
				{
					name: "ComposerExt",
					composer: "group/ComposerExt",
					version: "1.2.3",
				},
			],
			priorInstallation: [
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt.git",
					version: "1.2.3",
					config: "this line has changed",
					more_config: "and so has this one",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "all",
					wikis: ["onewiki", "twowiki", "threewiki"],
				},
				{
					name: "MyExt2",
					repo: "https://git.example.com/MyExt2.git",
					version: "1.2.3",
					config: "$configThing = 1;\n$configThing2 = 'two';",
				},
				{
					name: "ComposerExt",
					composer: "group/ComposerExt",
					version: "1.2.3",
				},
			],
		});

		expect(result).toEqual({ status: "CHANGED", runUpdatePhp: ["threewiki"] });
	});

	test("overwrite config and merge requirements for which wikis to run update.php", async () => {
		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt.git",
					version: "1.2.3",
					config: "this line has changed",
					more_config: "and so has this one",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "all",
					wikis: ["onewiki", "twowiki"],
				},
				{
					name: "MyExt2",
					repo: "https://git.example.com/MyExt2.git",
					version: "1.2.3",
					config: "$configThing = 1;\n$configThing2 = 'two';",
					update_php_on_change: "all",
					wikis: ["onewiki", "fourwiki"],
				},
				{
					name: "ComposerExt",
					composer: "group/ComposerExt",
					version: "1.2.3",
					update_php_on_change: "all",
					wikis: ["twowiki", "sixwiki"],
				},
			],
			priorInstallation: [
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt.git",
					version: "1.2.3",
					config: "this line has changed",
					more_config: "and so has this one",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: "all",
					wikis: ["onewiki", "twowiki", "threewiki"],
				},
				{
					name: "MyExt2",
					repo: "https://git.example.com/MyExt2.git",
					version: "1.2.3",
					config: "$configThing = 1;\n$configThing2 = 'two';",
					update_php_on_change: "all",
					wikis: ["onewiki", "fivewiki"],
				},
				{
					name: "ComposerExt",
					composer: "group/ComposerExt",
					version: "1.2.4",
					update_php_on_change: "all",
					wikis: ["twowiki", "sixwiki"],
				},
			],
		});

		expect(result).toEqual({
			status: "CHANGED",
			runUpdatePhp: ["threewiki", "fivewiki", "twowiki", "sixwiki"],
		});
	});

	test("overwrite config and run update.php on all wikis", async () => {
		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [
				{
					name: "ComposerExt",
					composer: "group/ComposerExt",
					version: "1.2.3",
					update_php_on_change: "all",
				},
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt",
					version: "5.5.5",
				},
			],
			priorInstallation: [
				{
					name: "ComposerExt",
					composer: "group/ComposerExt",
					version: "1.2.4",
					update_php_on_change: "all",
				},
			],
		});

		expect(result).toEqual({
			status: "CHANGED",
			runUpdatePhp: true,
		});
	});

	test("handle skins", async () => {
		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [
				{
					name: "SomeSkin",
					repo: "https://git.example.com/SomeSkin",
					version: "1.2.6",
					skin: true,
					update_php_on_change: "all",
				},
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt",
					version: "5.5.5",
				},
			],
			priorInstallation: [
				{
					name: "SomeSkin",
					repo: "https://git.example.com/SomeSkin",
					version: "1.2.3",
					skin: true,
					update_php_on_change: "all",
				},
			],
		});

		expect(result).toEqual({
			status: "CHANGED",
			runUpdatePhp: true,
		});
	});
});

describe("doExtensions() errors", () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	test("error if unable to run git commands", async () => {
		makeReadFileSpy("{}");
		makeWriteFileSpy({ throws: false });
		makeAsyncExecSpy({ throws: true });
		const consoleErrorSpy = makeConsoleErrorSpy();

		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt",
					version: "5.5.5",
				},
			],
			priorInstallation: [],
		});

		expect(result).toEqual({
			status: "ERROR",
		});
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});

	test("error if fails to write ExtensionSettings.php", async () => {
		makeReadFileSpy("{}");
		makeAsyncExecSpy({ throws: false });
		const consoleErrorSpy = makeConsoleErrorSpy();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const mockWriteFile: any = async (filepath: string) => {
			if (filepath.includes("ExtensionSettings.php")) {
				return Promise.reject("testing reject writeFile");
			}

			return Promise.resolve();
		};
		jest.spyOn(fs.promises, "writeFile").mockImplementation(mockWriteFile);

		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt",
					version: "5.5.5",
				},
			],
			priorInstallation: [],
		});

		expect(result).toEqual({
			status: "ERROR",
		});
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});

	test("error if fails to run composer commands", async () => {
		makeReadFileSpy("{}");
		makeWriteFileSpy({ throws: false });
		const consoleErrorSpy = makeConsoleErrorSpy();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const asyncExecMock: any = (cmd: string) => {
			if (cmd.includes("composer install")) {
				return Promise.reject();
			}
			return Promise.resolve();
		};

		jest.spyOn(asyncExecModule, "asyncExec").mockImplementation(asyncExecMock);

		const result = await doExtensions({
			appMediawikiPath: "/path/to/mw",
			controllerComposerCmd: "/path/to/composer",
			extensionsConfig: [
				{
					name: "MyExt",
					repo: "https://git.example.com/MyExt",
					version: "5.5.5",
				},
			],
			priorInstallation: [],
		});

		expect(result).toEqual({
			status: "ERROR",
		});
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});
});

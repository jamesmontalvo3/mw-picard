import getExtensionConfig, {
	isExtensionConfig,
	isExtensionConfigArray,
	isPartialExtensionConfigArray,
	mergeExtensionConfigs,
} from "./getExtensionConfig";
import { makeConsoleErrorSpy } from "./test-utils";

describe("isExtensionConfig()", () => {
	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});
	test("return false on invalid ExtensionConfig", () => {
		const consoleErrorSpy = makeConsoleErrorSpy();
		expect(isExtensionConfig(undefined)).toBe(false);
		expect(isExtensionConfig(null)).toBe(false);
		expect(isExtensionConfig(false)).toBe(false);
		expect(isExtensionConfig(true)).toBe(false);
		expect(isExtensionConfig(2131)).toBe(false);
		expect(isExtensionConfig("ExtensionConfig")).toBe(false);
		expect(isExtensionConfig({})).toBe(false);
		expect(isExtensionConfig({ name: "ExtensionName" })).toBe(false);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(11);
	});

	test("return true on valid ExtensionConfig", () => {
		expect(
			isExtensionConfig({
				name: "ExtensionName",
				version: "1.2.3",
				composer: "asdf",
			})
		).toBe(true);
		expect(
			isExtensionConfig({
				name: "ExtensionName",
				version: "1.2.3",
				repo: "https://git.example.come/ExtensionName",
			})
		).toBe(true);
		expect(
			isExtensionConfig({
				name: "ExtensionName",
				version: "1.2.3",
				repo: "https://git.example.come/ExtensionName",
				evenReturnsTrueWithBogusExtraProps: "asdf",
			})
		).toBe(true);
	});
});

describe("isExtensionConfigArray()", () => {
	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});
	test("return false for non-arrays", () => {
		const consoleErrorSpy = makeConsoleErrorSpy();

		expect(isExtensionConfigArray({})).toEqual(false);
		expect(consoleErrorSpy).toHaveBeenLastCalledWith(
			"Extension config array must be array"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

		expect(isExtensionConfigArray("stuff")).toEqual(false);
		expect(consoleErrorSpy).toHaveBeenLastCalledWith(
			"Extension config array must be array"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

		expect(isExtensionConfigArray(42)).toEqual(false);
		expect(consoleErrorSpy).toHaveBeenLastCalledWith(
			"Extension config array must be array"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
	});
	test("return false if any array element fails isExtensionConfig()", () => {
		const consoleErrorSpy = makeConsoleErrorSpy();
		expect(isExtensionConfigArray([{}, { name: "MyExt" }])).toEqual(false);
		expect(
			isExtensionConfigArray([{ name: "MyExt" }, "not an object"])
		).toEqual(false);
		expect(isExtensionConfigArray([null])).toEqual(false);
		expect(
			isExtensionConfigArray([
				{ name: "MyExt", version: "1.2.3", repo: "https://example.com" },
				{ name: "MyExt", version: "1.2.3" },
			])
		).toEqual(false);
		expect(
			isExtensionConfigArray([
				{ name: "MyExt", version: "1.2.3", repo: "https://example.com" },
				{ name: "MyExt", repo: "https://example.com" },
			])
		).toEqual(false);
		expect(
			isExtensionConfigArray([
				{ name: "MyExt", version: "1.2.3", repo: "https://example.com" },
				{ version: "1.2.3", repo: "https://example.com" },
			])
		).toEqual(false);
		expect(
			isExtensionConfigArray([
				{ name: "MyExt", version: "1.2.3", composer: "group/ext" },
				{ name: "MyExt", version: "1.2.3" },
			])
		).toEqual(false);
		expect(
			isExtensionConfigArray([
				{ name: "MyExt", version: "1.2.3", composer: "group/ext" },
				{ name: "MyExt", composer: "group/ext" },
			])
		).toEqual(false);
		expect(
			isExtensionConfigArray([
				{ name: "MyExt", version: "1.2.3", composer: "group/ext" },
				{ version: "1.2.3", composer: "group/ext" },
			])
		).toEqual(false);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Not a valid WikiConfig: {"version":"1.2.3","composer":"group/ext"}'
		);
	});
	test("return true for valid input", () => {
		expect(
			isExtensionConfigArray([
				{ name: "Ext2", version: "1.2.3", repo: "https://example.com" },
				{ name: "Ext2", version: "1.2.3", composer: "group/ext" },
			])
		).toEqual(true);
	});
});

describe("isPartialExtensionConfigArray()", () => {
	test("return false for non-arrays", () => {
		expect(isPartialExtensionConfigArray({})).toEqual(false);
		expect(isPartialExtensionConfigArray("stuff")).toEqual(false);
		expect(isPartialExtensionConfigArray(42)).toEqual(false);
	});
	test("return false if any array element fails isPartialExtensionConfig()", () => {
		expect(isPartialExtensionConfigArray([{}, { name: "MyExt" }])).toEqual(
			false
		);
		expect(
			isPartialExtensionConfigArray([{ name: "MyExt" }, "not an object"])
		).toEqual(false);
		expect(isPartialExtensionConfigArray([null])).toEqual(false);
	});
	test("return true for valid input", () => {
		expect(
			isPartialExtensionConfigArray([
				{ name: "MyExt" },
				{ name: "Ext2", version: "1.2.3", repo: "https://example.com" },
			])
		).toEqual(true);
	});
});

describe("mergeExtensionConfigs()", () => {
	test("perform typical merge for standard", () => {
		expect(
			mergeExtensionConfigs(
				{ name: "Extension1", repo: "http...", version: "1" },
				{ name: "Extension1" }
			)
		).toEqual({
			name: "Extension1",
			repo: "http...",
			version: "1",
		});
	});
	test("perform typical merge for composer extension", () => {
		expect(
			mergeExtensionConfigs(
				{ name: "Extension1", composer: "group/thing", version: "1" },
				{ name: "Extension1" }
			)
		).toEqual({
			name: "Extension1",
			composer: "group/thing",
			version: "1",
		});
	});
	test("include optional props from baseline", () => {
		expect(
			mergeExtensionConfigs(
				{
					name: "Extension1",
					composer: "http...",
					version: "1",
					config: '$thing = "stuff";',
					more_config: '$moreThing = "more stuff";',
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
				},
				{ name: "Extension1" }
			)
		).toEqual({
			name: "Extension1",
			composer: "http...",
			version: "1",
			config: '$thing = "stuff";',
			more_config: '$moreThing = "more stuff";',
			composer_merge: true,
			git_submodules: true,
			legacy_load: true,
		});
	});
	test("override baseline", () => {
		expect(
			mergeExtensionConfigs(
				{
					name: "aaa",
					composer: "bbb",
					version: "ccc",
					config: "ddd",
					more_config: "eee",
					composer_merge: false,
					git_submodules: false,
					legacy_load: false,
				},
				{
					name: "Extension1",
					composer: "http...",
					version: "1",
					config: '$thing = "stuff";',
					more_config: '$moreThing = "more stuff";',
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
				}
			)
		).toEqual({
			name: "Extension1",
			composer: "http...",
			version: "1",
			config: '$thing = "stuff";',
			more_config: '$moreThing = "more stuff";',
			composer_merge: true,
			git_submodules: true,
			legacy_load: true,
		});
	});
	test("use 'composer' prop if specified used 'composer' and baseline used 'repo'", () => {
		expect(
			mergeExtensionConfigs(
				{ name: "Extension1", repo: "http...", version: "1" },
				{ name: "Extension1", composer: "group/thing", version: "x" }
			)
		).toEqual({
			name: "Extension1",
			composer: "group/thing",
			version: "x",
		});
	});
	test("use 'repo' prop if specified used 'repo' and baseline used 'compose'", () => {
		expect(
			mergeExtensionConfigs(
				{ name: "Extension1", composer: "group/thing", version: "x" },
				{ name: "Extension1", repo: "http...", version: "1" }
			)
		).toEqual({
			name: "Extension1",
			repo: "http...",
			version: "1",
		});
	});
});

describe("getExtensionConfig()", () => {
	test("handle a simple config merge", () => {
		expect(
			getExtensionConfig(
				[
					{ name: "Extension1", repo: "http:1", version: "1.1.1" },
					{ name: "Extension2", repo: "http:2", version: "2.2.2" },
				],
				[
					{ name: "Extension1" },
					{ name: "Extension2" },
					{ name: "Extension3", composer: "group/thing", version: "3.3.3" },
				]
			)
		).toEqual([
			{ name: "Extension1", repo: "http:1", version: "1.1.1" },
			{ name: "Extension2", repo: "http:2", version: "2.2.2" },
			{ name: "Extension3", composer: "group/thing", version: "3.3.3" },
		]);
	});
	test("log an error if an incomplete extension config is encountered", () => {
		const spy = jest.spyOn(console, "error").mockImplementation(() => null);
		expect(
			getExtensionConfig(
				[
					{ name: "Extension1", repo: "http:1", version: "1.1.1" },
					{ name: "Extension2", repo: "http:2", version: "2.2.2" },
				],
				[
					{ name: "Extension1" },
					{ name: "Extension2" },
					{ name: "Extension3", composer: "group/thing" },
				]
			)
		).toEqual([
			{ name: "Extension1", repo: "http:1", version: "1.1.1" },
			{ name: "Extension2", repo: "http:2", version: "2.2.2" },
		]);
		expect(spy).toHaveBeenCalledTimes(2);
		spy.mockRestore();
	});
});

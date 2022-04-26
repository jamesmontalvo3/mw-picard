import path from "upath";
import processExtensions from "./processExtensions";
import * as asyncExecModule from "./asyncExec";
import {
	makeAsyncRimrafSpy,
	makeAsyncExecSpy,
	makeReadFileSpy,
	makeWriteFileSpy,
	makeConsoleErrorSpy,
} from "./test-utils";

describe("processExtensions()", () => {
	// FIXME cleanup mocks after each?

	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	test("error when loading YAML throws", async () => {
		const consoleErrorSpy = makeConsoleErrorSpy();
		makeReadFileSpy(false);
		expect(
			await processExtensions({
				baseline: "/path/to/baseline.yml",
				specifier: "/path/to/specifier.yml",
				mediawiki: "/path/to/mediawiki",
				controllerComposerCmd: "/path/to/composer",
			})
		).toEqual({
			msg: 'Error loading extension config. Error was: "testing reject readFile"',
			status: "ERROR",
		});
		expect(consoleErrorSpy).toHaveBeenCalledWith("testing reject readFile");
	});

	test("error when baseline isn't ExtensionConfig[]", async () => {
		const consoleErrorSpy = makeConsoleErrorSpy();
		makeReadFileSpy({
			"/path/to/baseline.yml": `[{ "name": "MyExt" }]`, // invalid baseline
			"/path/to/specifier.yml": `[{ "name": "MyExt" }]`, // valid specifier
			// no prior install
		});
		expect(
			await processExtensions({
				baseline: "/path/to/baseline.yml",
				specifier: "/path/to/specifier.yml",
				mediawiki: "/path/to/mediawiki",
				controllerComposerCmd: "/path/to/composer",
			})
		).toEqual({ msg: "baseline invalid", status: "ERROR" });
		expect(consoleErrorSpy.mock.calls).toEqual([
			["Expected name to be string"],
			["WikiConfig needs either .repo or .composer value as string"],
			['Not a valid WikiConfig: {"name":"MyExt"}'],
		]);
	});

	test("error when baseline isn't PartialExtensionConfig[]", async () => {
		makeReadFileSpy({
			"/path/to/baseline.yml": `[{ "name": "MyExt", "repo": "https://git.example.com", "version": "1.2.3" }]`, // valid baseline
			"/path/to/specifier.yml": `[{ "thing": "MyExt" }]`, // invalid specifier
			"/path/to/prior-installation.yml": `[{ "name": "MyExt", "repo": "https://git.example.com", "version": "1.2.3" }]`, // valid prior
		});
		expect(
			await processExtensions({
				baseline: "/path/to/baseline.yml",
				specifier: "/path/to/specifier.yml",
				mediawiki: "/path/to/mediawiki",
				controllerComposerCmd: "/path/to/composer",
			})
		).toEqual({ msg: "specifier invalid", status: "ERROR" });
	});

	test("indicate changed when a baseline+specifier are valid with no prior install", async () => {
		const baselinePath = path.join("/path/to/baseline.yml");
		const specifierPath = path.join("/path/to/specifier.yml");
		makeReadFileSpy({
			// valid baseline
			[baselinePath]: `[
				{ "name": "MyExt", "repo": "https://git.example.com", "version": "1.2.3" }
			]`,

			// valid specifier
			[specifierPath]: `[{ "name": "MyExt" }]`,

			// missing prior install
		});
		makeWriteFileSpy({ throws: false });
		makeAsyncExecSpy({ throws: false });
		makeAsyncRimrafSpy({ throws: false });
		expect(
			await processExtensions({
				baseline: baselinePath,
				specifier: specifierPath,
				mediawiki: "/path/to/mediawiki",
				controllerComposerCmd: "/path/to/composer",
			})
		).toEqual({ status: "CHANGED", runUpdatePhp: false });
	});

	test("indicate no change if prior install matches current", async () => {
		const baselinePath = path.join("/path/to/baseline.yml");
		const specifierPath = path.join("/path/to/specifier.yml");
		const priorPath = path.join("/path/to/prior-installation.yml");
		makeReadFileSpy({
			// valid baseline
			[baselinePath]: `[
				{ "name": "MyExt", "repo": "https://git.example.com", "version": "1.2.3" }
			]`,

			// valid specifier
			[specifierPath]: `[{ "name": "MyExt" }]`,

			// same prior install
			[priorPath]: `[
				{ "name": "MyExt", "repo": "https://git.example.com", "version": "1.2.3" }
			]`,
		});
		makeWriteFileSpy({ throws: false });
		makeAsyncExecSpy({ throws: false });
		makeAsyncRimrafSpy({ throws: false }); // make async rimraf same as others fixme
		expect(
			await processExtensions({
				baseline: baselinePath,
				specifier: specifierPath,
				mediawiki: "/path/to/mediawiki",
				controllerComposerCmd: "/path/to/composer",
			})
		).toEqual({ status: "NOCHANGE" });
	});

	test("error if composer command fails (or any doExtensions() command)", async () => {
		const baselinePath = path.join("/path/to/baseline.yml");
		const specifierPath = path.join("/path/to/specifier.yml");
		makeReadFileSpy({
			// valid baseline
			[baselinePath]: `[
				{ "name": "MyExt", "repo": "https://git.example.com", "version": "1.2.3" }
			]`,

			// valid specifier
			[specifierPath]: `[{ "name": "MyExt" }]`,

			// missing prior install
		});
		makeWriteFileSpy({ throws: false });
		makeAsyncExecSpy({ throws: false });
		makeConsoleErrorSpy(); // check the error fixme? what's it say?

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const asyncExecMock: any = (cmd: string) => {
			if (cmd.includes("composer install")) {
				return Promise.reject();
			}
			return Promise.resolve();
		};
		jest.spyOn(asyncExecModule, "asyncExec").mockImplementation(asyncExecMock);

		expect(
			await processExtensions({
				baseline: baselinePath,
				specifier: specifierPath,
				mediawiki: "/path/to/mediawiki",
				controllerComposerCmd: "/path/to/composer",
			})
		).toEqual({ status: "ERROR" });
	});
});

import path from "path";
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
	it("should error when loading YAML throws", async () => {
		makeReadFileSpy(false);
		expect(
			await processExtensions({
				baseline: "/path/to/baseline.yml",
				specifier: "/path/to/specifier.yml",
				mediawiki: "/path/to/mediawiki",
				composerCmd: "/path/to/composer",
			})
		).toEqual({ status: "ERROR" });
	});

	it("should error when baseline isn't ExtensionConfig[]", async () => {
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
				composerCmd: "/path/to/composer",
			})
		).toEqual({ status: "ERROR" });
	});

	it("should error when baseline isn't PartialExtensionConfig[]", async () => {
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
				composerCmd: "/path/to/composer",
			})
		).toEqual({ status: "ERROR" });
	});

	it("should indicate changed when a baseline+specifier are valid with no prior install", async () => {
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
		makeAsyncRimrafSpy(() => async () => undefined); // make async rimraf same as others fixme
		expect(
			await processExtensions({
				baseline: baselinePath,
				specifier: specifierPath,
				mediawiki: "/path/to/mediawiki",
				composerCmd: "/path/to/composer",
			})
		).toEqual({ status: "CHANGED", runUpdatePhp: false });
	});

	it("should indicate no change if prior install matches current", async () => {
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
		makeAsyncRimrafSpy(() => async () => undefined); // make async rimraf same as others fixme
		expect(
			await processExtensions({
				baseline: baselinePath,
				specifier: specifierPath,
				mediawiki: "/path/to/mediawiki",
				composerCmd: "/path/to/composer",
			})
		).toEqual({ status: "NOCHANGE" });
	});

	it("should error if composer command fails (or any doExtensions() command)", async () => {
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
		makeConsoleErrorSpy();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const asyncExecMock: any = (cmd: string) => {
			if (cmd.includes("composer install")) {
				return Promise.reject();
			}
			return Promise.resolve();
		};
		// fixme make asyncExec mock util more flexible
		jest.spyOn(asyncExecModule, "asyncExec").mockImplementation(asyncExecMock);

		expect(
			await processExtensions({
				baseline: baselinePath,
				specifier: specifierPath,
				mediawiki: "/path/to/mediawiki",
				composerCmd: "/path/to/composer",
			})
		).toEqual({ status: "ERROR" });
	});
});

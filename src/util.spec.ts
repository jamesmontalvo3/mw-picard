import { makeConsoleErrorSpy } from "./test-utils";
import { pathResolve } from "./util";

describe("pathResolve()", () => {
	let consoleErrorSpy: jest.SpyInstance;
	let prefix = "";
	beforeAll(() => {
		const cwd = process.cwd();
		if (/^\w:/.test(cwd)) {
			prefix = cwd.slice(0, 2);
		}
	});

	beforeEach(() => {
		consoleErrorSpy = makeConsoleErrorSpy();
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	// ABSOLUTE PATHS
	test("handle an absolute path", async () => {
		expect(pathResolve("/my/abs/path", false)).toEqual(prefix + "/my/abs/path");
		expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
	});
	test("handle an absolute path with ..", async () => {
		expect(pathResolve("/my/abs/path/../with/dotdot", false)).toEqual(
			prefix + "/my/abs/with/dotdot"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
	});

	// RELATIVE PATHS
	test("handle relative path starting with .", async () => {
		expect(pathResolve("./my/path", "/base/path")).toEqual(
			prefix + "/base/path/my/path"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
	});
	test("handle relative path starting with ..", async () => {
		expect(pathResolve("../my/path", "/base/path")).toEqual(
			prefix + "/base/my/path"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
	});
	test("handle relative path starting with no . or non-slash", async () => {
		expect(pathResolve("my/path", "/base/path")).toEqual(
			prefix + "/base/path/my/path"
		);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
	});

	// USING CWD
	test("handle lack of base path by using process.cwd()", async () => {
		jest.spyOn(process, "cwd").mockImplementation(() => "/cwd/path");
		expect(pathResolve("my/path", false)).toEqual(prefix + "/cwd/path/my/path");
		expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
	});

	// INVALID CASES
	test("reject root path /", async () => {
		// fixme why?
		expect(pathResolve("/", false)).toEqual(false);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});
	test("reject empty path", async () => {
		expect(pathResolve("", false)).toEqual(false);
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});
});

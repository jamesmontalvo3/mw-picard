import fs from "fs";
import * as asyncExecModule from "./asyncExec";
import * as asyncRimrafModule from "./asyncRimraf";

export const makeAsyncRimrafSpy = ({
	throws,
}: {
	throws: boolean;
}): jest.SpyInstance => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const mock: any = throws ? () => Promise.reject() : () => Promise.resolve();
	return (
		jest
			.spyOn(asyncRimrafModule, "asyncRimraf")
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.mockImplementation(mock)
	);
};

export const makeAsyncExecSpy = ({
	throws,
}: {
	throws: boolean;
}): jest.SpyInstance => {
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

export const makeReadFileSpy = (
	result: string | false | Record<string, string>
): jest.SpyInstance => {
	const mock: any = result // eslint-disable-line @typescript-eslint/no-explicit-any
		? typeof result === "string"
			? () => Promise.resolve(result)
			: (filepath: string) => {
					return result[filepath]
						? Promise.resolve(result[filepath])
						: Promise.reject("Mock: cannot find file");
			  }
		: () => Promise.reject("testing reject readFile");
	return jest.spyOn(fs.promises, "readFile").mockImplementation(mock);
};

export const makeWriteFileSpy = ({
	throws,
	writeTo = { written: "" },
}: {
	throws: boolean;
	writeTo?: { written: string };
}): jest.SpyInstance => {
	const mock: any = throws // eslint-disable-line @typescript-eslint/no-explicit-any
		? () => Promise.reject("testing reject writeFile")
		: (filepath: string, content: string | Buffer) => {
				writeTo.written = content.toString();
				return Promise.resolve();
		  };
	return jest.spyOn(fs.promises, "writeFile").mockImplementation(mock);
};

export const makeConsoleErrorSpy = (): jest.SpyInstance => {
	return jest.spyOn(console, "error").mockImplementation(jest.fn());
};

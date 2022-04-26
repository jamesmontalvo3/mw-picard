import { ExecaReturnValue } from "execa";
import { asyncExec } from "./asyncExec";

describe("asyncExec()", () => {
	test("reject/throw for a bad command 2222222222", async () => {
		let result: {
			stdout?: string;
			stderr?: string;
			error?: ExecaReturnValue;
		};
		try {
			const res = await asyncExec("THIS_IS_A_BOGUS_COMMAND");
			result = { ...res };
		} catch (err) {
			const error =
				typeof err === "object" && err !== null
					? (err as ExecaReturnValue)
					: ({} as ExecaReturnValue);
			result = { error };
		}

		expect(result.stdout).toBeFalsy();
		expect(result.stderr).toBeFalsy();

		expect(result.error).toBeDefined();
		if (!result.error) {
			return; // this allows types to work below
		}

		expect(result.error.killed).toEqual(false);
		expect(result.error.signal).toBeUndefined();
		expect(result.error.command).toEqual("THIS_IS_A_BOGUS_COMMAND");

		// stdout and stderr on Error object, not from try {...}
		expect(result.error.stdout).toEqual("");
		expect(typeof result.error.stderr).toEqual("string");
		expect(result.error.stderr.length).toBeGreaterThan(1);
	});

	test("resolve for a valid command", async () => {
		// `echo` is valid DOS and shell command
		const { stdout, stderr } = await asyncExec(
			"echo 'this is a test of asyncExec' && echo 'another'"
		);

		expect(typeof stdout === "string").toEqual(true);
		expect(stdout.length > 0).toEqual(true);

		expect(typeof stdout === "string").toEqual(true);
		expect(stderr.length).toEqual(0);
	});
});

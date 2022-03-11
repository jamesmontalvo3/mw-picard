import { asyncExec, ExecError } from "./asyncExec";

describe("asyncExec()", () => {
	test("reject/throw for a bad command 2222222222", async () => {
		let result: {
			stdout?: string;
			stderr?: string;
			error?: ExecError;
		};
		try {
			const res = await asyncExec("THIS_IS_A_BOGUS_COMMAND");
			result = { ...res };
		} catch (err) {
			const error =
				typeof err === "object" && err !== null
					? (err as ExecError)
					: ({} as ExecError);
			result = { error };
		}

		expect(result.stdout).toBeFalsy();
		expect(result.stderr).toBeFalsy();

		expect(result.error).toBeDefined();
		if (!result.error) {
			return; // this allows types to work below
		}

		expect(result.error.killed).toEqual(false);
		expect(result.error.code).toEqual(1);
		expect(result.error.signal).toBeNull();
		expect(result.error.cmd).toEqual("THIS_IS_A_BOGUS_COMMAND");

		// stdout and stderr on Error object, not from try {...}
		expect(result.error.stdout).toEqual("");
		expect(typeof result.error.stderr).toEqual("string");
		expect(result.error.stderr.length).toBeGreaterThan(1);
	});

	test("resolve for a valid command", async () => {
		const { stdout, stderr } = await asyncExec("dir"); // `dir` is valid DOS and Bash command

		expect(typeof stdout === "string").toEqual(true);
		expect(stdout.length > 0).toEqual(true);

		expect(typeof stdout === "string").toEqual(true);
		expect(stderr.length).toEqual(0);
	});
});

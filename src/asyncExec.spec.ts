import asyncExec, { ExecError } from "./asyncExec";
import { exec } from "child_process";

describe("asyncExec()", () => {
	// it("should reject/throw for a bad command", async () => {
	// 	const promise = asyncExec("THIS_IS_A_BOGUS_COMMAND");
	// 	await expect(promise).rejects.toEqual("something");
	// });

	// FIXME
	it("should reject/throw for a bad command 2222222222", async () => {
		let result: {
			stdout?: string;
			stderr?: string;
			error?: unknown;
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

		console.log("CODE --->", Object.keys(result.error as any));

		expect(result.stdout).toBeFalsy();
		expect(result.stderr).toBeFalsy();
		expect(result.error).toEqual("something");
	});

	// it("should give no stdout/stderr and produce error for a bad command", async () => {
	// 	let result: {
	// 		stdout?: string;
	// 		stderr?: string;
	// 		error?: unknown;
	// 	};
	// 	try {
	// 		const res = await asyncExec("THIS_IS_A_BOGUS_COMMAND");
	// 		result = { ...res };
	// 	} catch (error) {
	// 		result = { error };
	// 	}
	// 	expect(result.stdout).toBeFalsy();
	// 	expect(result.stderr).toBeFalsy();
	// 	expect(result.error).toBeFalsy();
	// });

	it("should resolve for a valid command", async () => {
		const { stdout, stderr } = await asyncExec("dir"); // `dir` is valid DOS and Bash command

		expect(typeof stdout === "string").toEqual(true);
		expect(stdout.length > 0).toEqual(true);

		expect(typeof stdout === "string").toEqual(true);
		expect(stderr.length).toEqual(0);
	});
});

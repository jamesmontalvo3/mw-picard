import util from "util";
import { exec } from "child_process";
import { execaCommand, ExecaReturnValue } from "execa";
import dedent from "dedent-js";

export type ExecError = {
	killed: boolean;
	code: number;
	signal: unknown;
	cmd: string;
	stdout: string;
	stderr: string;
	stack: string;
};
// FIXME remove
export const yeOldeAsyncExec = util.promisify(exec);

export const asyncExec = async (
	command: string,
	cwd?: string
): Promise<ExecaReturnValue<string>> => {
	console.log(
		dedent`
		Running command(s):
		  directory: ${cwd || process.cwd()}
		  command(s): ${command}`
	);

	const commands = command.split("&&").map((cmd) => cmd.trim());

	let finalResult: ExecaReturnValue<string> | undefined;
	for (const cmd of commands) {
		const subprocess = execaCommand(cmd, { cwd });
		subprocess.stdout?.pipe(process.stdout);
		subprocess.stderr?.pipe(process.stderr);

		finalResult = await subprocess;
	}

	if (typeof finalResult === "undefined") {
		throw new Error("No commands run for: " + command);
	}

	return finalResult;
};

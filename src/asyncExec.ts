import execa, { ExecaReturnValue } from "execa";

const runCmd = (
	cmd: string,
	cwd?: string
): Promise<ExecaReturnValue<string>> => {
	const subprocess = execa.command(cmd, { cwd });
	subprocess.stdout?.pipe(process.stdout);
	subprocess.stderr?.pipe(process.stderr);

	return subprocess;
};

export const asyncExec = async (
	command: string,
	cwd?: string
): Promise<ExecaReturnValue<string>> => {
	const commands = command.split("&&").map((cmd) => cmd.trim());

	let finalResult: ExecaReturnValue<string> = await runCmd(commands[0], cwd);

	// run additional commands if they exist
	for (let i = 1; i < commands.length; i++) {
		finalResult = await runCmd(commands[i], cwd);
	}

	return finalResult;
};

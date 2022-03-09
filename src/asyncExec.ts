import util from "util";
import { exec } from "child_process";

export type ExecError = {
	killed: boolean;
	code: number;
	signal: unknown;
	cmd: string;
	stdout: string;
	stderr: string;
	stack: string;
};
export const asyncExec = util.promisify(exec);

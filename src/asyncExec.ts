import util from "util";
import { exec } from "child_process";
const asyncExec = util.promisify(exec);

export type ExecError = {
	killed: boolean;
	code: number;
	signal: unknown;
	cmd: string;
	stdout: string;
	stderr: string;
};

export default asyncExec;

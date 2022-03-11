import util from "util";
import rimraf from "rimraf";
export const asyncRimraf = util.promisify(rimraf);

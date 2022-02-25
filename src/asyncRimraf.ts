import util from "util";
import rimraf from "rimraf";
const asyncRimraf = util.promisify(rimraf);

export default asyncRimraf;

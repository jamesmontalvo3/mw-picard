// import util from "util";
// import rimraf from "rimraf";
// const asyncRimraf = util.promisify(rimraf);

// export default asyncRimraf;

export const asyncRimraf = async (path: string): Promise<void> => {
	console.error("actually called asyncRimraf with: " + path);
};

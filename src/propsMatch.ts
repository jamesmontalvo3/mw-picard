import deepEqual from "lodash/isEqual";

const propsMatch = (
	obj1: Record<string, unknown>,
	obj2: Record<string, unknown>,
	props: string[]
): boolean => {
	for (const prop of props) {
		if (!deepEqual(obj1[prop], obj2[prop])) {
			return false;
		}
	}
	return true;
};

export default propsMatch;

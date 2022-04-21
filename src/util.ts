export const couldBe = <T>(
	maybe: unknown
): maybe is Partial<Record<keyof T, unknown>> => {
	return typeof maybe === "object" && maybe !== null;
};

export const verifyAllUnique = (arr: string[]): undefined | AppError[] => {
	const errors: AppError[] = [];

	const alreadyFoundValue: Record<string, true> = {};
	for (let i = 0; i < arr.length; i++) {
		if (alreadyFoundValue[arr[i]]) {
			errors.push({
				errorType: "AppError",
				msg: `Wiki ID or redirect "${arr[i]}" found more than once`,
			});
		} else {
			alreadyFoundValue[arr[i]] = true;
		}
	}
	if (errors.length) {
		return errors;
	}
};

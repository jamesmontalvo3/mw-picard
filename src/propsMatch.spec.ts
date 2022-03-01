import propsMatch from "./propsMatch";

describe("propsMatch()", () => {
	it("should return true for simple primitive cases", () => {
		expect(
			propsMatch({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 3 }, ["a", "b", "c"])
		).toEqual(true);
		expect(
			propsMatch({ a: 1, b: 2 }, { a: 1, b: 2, c: 3 }, ["a", "b"])
		).toEqual(true);
		expect(
			propsMatch({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 }, ["a", "b"])
		).toEqual(true);
	});

	it("should return true if the desired props match and others do not", () => {
		expect(
			propsMatch({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: "test" }, ["a", "b"])
		).toEqual(true);
	});

	it("should return false for failed simple primitive cases", () => {
		expect(
			propsMatch({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: "3" }, ["a", "b", "c"])
		).toEqual(false);
		expect(
			propsMatch({ a: 1, b: 2 }, { a: 1, b: 23, c: 3 }, ["a", "b"])
		).toEqual(false);
		expect(
			propsMatch({ a: 1, b: 2, c: 3 }, { a: 1, b: [1, 2] }, ["a", "b"])
		).toEqual(false);
	});

	it("should return true for deep-equality cases", () => {
		expect(
			propsMatch(
				{ a: { x: 1, y: 2 }, b: 2, c: 3 },
				{ a: { x: 1, y: 2 }, b: 2, c: 3 },
				["a", "b", "c"]
			)
		).toEqual(true);
		expect(
			propsMatch(
				{ a: { x: 1, y: ["an", "array"] }, b: 2, c: 3 },
				{ a: { x: 1, y: ["an", "array"] }, b: 2, c: 3 },
				["a", "b", "c"]
			)
		).toEqual(true);
	});

	it("should return false for failed deep-equality cases", () => {
		expect(
			propsMatch(
				{ a: { x: 1, y: 2 }, b: 2, c: 3 },
				{ a: { x: 1, y: "2" }, b: 2, c: 3 },
				["a", "b", "c"]
			)
		).toEqual(false);
		expect(
			propsMatch(
				{ a: { x: 1, y: ["an", "array"] }, b: 2, c: 3 },
				{ a: { x: 1, y: ["an", "array", "that's different"] }, b: 2, c: 3 },
				["a", "b", "c"]
			)
		).toEqual(false);
	});
});

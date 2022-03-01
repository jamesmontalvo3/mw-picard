import { shouldUpdateExtension } from "./doGitExtensions";

describe("propsMatch()", () => {
	it("should update extension if props change", () => {
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://git.example.com/MyExtension",
				}
			)
		).toEqual(false);
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				}
			)
		).toEqual(false);
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyExtension",
					version: "1.2.5",
					repo: "https://example.com/MyExtension",
				}
			)
		).toEqual(false);
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					composer: "my/extension",
				}
			)
		).toEqual(false);
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyNewlyNamedExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				}
			)
		).toEqual(false);
	});

	it("should not update extension if props don't change", () => {
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					more_config: "asdf",
					composer_merge: true,
					git_submodules: true,
					legacy_load: true,
					update_php_on_change: 'code-changes',
					wikis: ["onewiki", "twowiki"],
				}
			)
		).toEqual(false);
		expect(
			shouldUpdateExtension(
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "config 11111",
				},
				{
					name: "MyExtension",
					version: "1.2.3",
					repo: "https://example.com/MyExtension",
					config: "config 222222",
				}
			)
		).toEqual(false);
	});
});

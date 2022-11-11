import doLocalSettings from "./doLocalSettings";
import fs from "fs";
import path from "upath";

describe("doLocalSettings()", () => {
	const loadLocalSettingsExpectedVals = async (
		caseNum: number
	): Promise<string> => {
		// async (case: number): Promise<string>) => {
		return fs.promises.readFile(
			path.join(
				__dirname,
				"..",
				"test-cases",
				`LocalSettings-Case${caseNum}.php`
			),
			"utf-8"
		);
	};

	process.env.APP_DB_PASSWORD = "password1";
	process.env.APP_DB_USER = "theuser";
	process.env.WG_SECRET_KEY = "1234abc";

	test("case 1: handle typical wiki", async () => {
		const expected = await loadLocalSettingsExpectedVals(1);
		expect(
			doLocalSettings({
				extensionsFiles: {
					baseline: "/path/to/baseline.yml",
					specifier: "/path/to/specifier.yml",
				},
				controllerComposerCmd: "/bin/composer",
				controllerMediawikiPath: "/controller/path/to/mediawiki",
				wikis: [
					{
						id: "mywiki",
						sitename: "My Wiki",
						redirectsFrom: ["oldwiki", "reallyoldwiki"],
						isPrimaryWiki: true,
						dbName: "db_mywiki",
					},
				],
				appMediawikiPath: "/path/to/mediawiki",
				appUploadsDirectory: "/path/to/uploads",

				appMoreConfigPath: "/path/to/config",
				wikiAppFqdn: "wiki.example.com",
				appCacheDirectory: "/path/to/cache",

				dbMaster: "db-master.example.com",
				dbReplicas: ["db-replica-1.example.com", "db-replica-2.example.com"],

				loadBalancers: ["lb1.example.com", "lb2.example.com"],
				memcachedServers: ["memcached1.example.com", "memcached2.example.com"],
				elasticsearchServers: [
					"es1.example.com",
					"es2.example.com",
					"es3.example.com",
				],
			})
		).toEqual(expected);
	});

	test("case 2: handle two primary wikis and overlapping redirects", async () => {
		expect(
			doLocalSettings({
				extensionsFiles: {
					baseline: "/path/to/baseline.yml",
					specifier: "/path/to/specifier.yml",
				},
				controllerComposerCmd: "/bin/composer",
				controllerMediawikiPath: "/controller/path/to/mediawiki",
				wikis: [
					{
						id: "mywiki",
						sitename: "My Wiki",
						redirectsFrom: ["oldwiki", "reallyoldwiki"],
						isPrimaryWiki: true,
						dbName: "db_mywiki",
					},
					{
						id: "mywiki2",
						sitename: "My Wiki 2",
						isPrimaryWiki: true,
						dbName: "db_mywiki",
					},
					{
						id: "oldwiki",
						sitename: "Old Wiki",
						dbName: "db_mywiki",
					},
				],
				appMediawikiPath: "/path/to/mediawiki",
				appUploadsDirectory: "/path/to/uploads",

				appMoreConfigPath: "/path/to/config",
				wikiAppFqdn: "wiki.example.com",
				appCacheDirectory: "/path/to/cache",

				dbMaster: "localhost", // run it on the app server

				loadBalancers: ["lb1.example.com", "lb2.example.com"],
				memcachedServers: ["memcached1.example.com", "memcached2.example.com"],
				elasticsearchServers: [
					"es1.example.com",
					"es2.example.com",
					"es3.example.com",
				],
			})
		).toEqual({
			errors: [
				{
					errorType: "AppError",
					msg: `Tried to set mywiki2 as primary wiki when already set to mywiki`,
				},
				{
					errorType: "AppError",
					msg: `Wiki ID or redirect "oldwiki" found more than once`,
				},
			],
		});
	});

	test("case 3: handle no primary wiki and app server running services", async () => {
		const expected = await loadLocalSettingsExpectedVals(3);
		expect(
			doLocalSettings({
				extensionsFiles: {
					baseline: "/path/to/baseline.yml",
					specifier: "/path/to/specifier.yml",
				},
				controllerComposerCmd: "/bin/composer",
				controllerMediawikiPath: "/controller/path/to/mediawiki",
				wikis: [
					{
						id: "mywiki",
						sitename: "My Wiki",
						redirectsFrom: ["oldwiki", "reallyoldwiki"],
						dbName: "db_mywiki",
					},
				],
				appMediawikiPath: "/path/to/mediawiki",
				appUploadsDirectory: "/path/to/uploads",

				appMoreConfigPath: "/path/to/config",
				wikiAppFqdn: "wiki.example.com",
				appCacheDirectory: "/path/to/cache",

				dbMaster: "db-master.example.com",
				dbReplicas: [
					"localhost", // run it on the app server
					"db-replica-1.example.com",
					"db-replica-2.example.com",
				],

				loadBalancers: [
					"localhost", // run it on the app server
					"lb1.example.com",
					"lb2.example.com",
				],
				memcachedServers: [
					"localhost", // run it on the app server
					"memcached1.example.com",
					"memcached2.example.com",
				],
				elasticsearchServers: [
					"localhost", // run it on the app server
					"es2.example.com",
					"es3.example.com",
				],
			})
		).toEqual(expected);
	});

	test("case 4: handle dev config and alternate settings", async () => {
		const expected = await loadLocalSettingsExpectedVals(4);
		expect(
			doLocalSettings({
				extensionsFiles: {
					baseline: "/path/to/baseline.yml",
					specifier: "/path/to/specifier.yml",
				},
				controllerComposerCmd: "/bin/composer",
				controllerMediawikiPath: "/controller/path/to/mediawiki",
				wikis: [
					{
						id: "mywiki",
						sitename: "My Wiki",
						dbName: "db_mywiki",
					},
				],
				appMediawikiPath: "/path/to/mediawiki",
				appUploadsDirectory: "/path/to/uploads",

				appMoreConfigPath: "/path/to/config",
				wikiAppFqdn: "localhost",
				appCacheDirectory: "/path/to/cache",

				dbMaster: "localhost",
				loadBalancers: ["localhost"],
				memcachedServers: ["localhost"],
				elasticsearchServers: ["localhost"],
			})
		).toEqual(expected);
	});
});

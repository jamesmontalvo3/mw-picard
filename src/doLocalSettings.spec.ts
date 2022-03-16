import doLocalSettings, { doPermissions } from "./doLocalSettings";
import fs from "fs";

describe("doLocalSettings()", () => {
	// FIXME name
	test("fixme", async () => {
		expect(
			doLocalSettings({
				wikis: [
					{
						id: "mywiki",
						redirectsFrom: ["oldwiki", "reallyoldwiki"],
						isPrimaryWiki: true,
						dbName: "db_mywiki",
					},
				],
				pathToWikis: "/path/to/wikis",
				mediawikiPath: "/path/to/mediawiki",

				mezaAuthType: "anon-read",
				phpConfigPath: "/path/to/config",
				allowRequestDebug: false,
				wikiAppFqdn: "wiki.example.com",
				enableEmail: true,
				wgPasswordSender: "admin@example.com",
				wgEmergencyContact: "admin@example.com",
				wgSecretKey: "1234abc",
				rootWgCacheDirectory: "/path/to/cache",
				wgAllowExternalImages: true,
				wgAllowImageTag: true,
				wgLocaltimezone: "America/Chicago",

				dbMaster: "db-master.example.com",
				dbReplicas: ["db-replica-1.example.com", "db-replica-2.example.com"],

				wikiAppDbPassword: "password1",
				wikiAppDbUser: "theuser",
				thisServer: "appserver.example.com",
				loadBalancers: ["lb1.example.com", "lb2.example.com"],
				memcachedServers: ["memcached1.example.com", "memcached2.example.com"],
				elasticsearchServers: [
					"es1.example.com",
					"es2.example.com",
					"es3.example.com",
				],
			})
		).toEqual("nothing");
	});

	// FIXME name
	test("handle two primary wikis and overlapping redirects", async () => {
		expect(
			doLocalSettings({
				wikis: [
					{
						id: "mywiki",
						redirectsFrom: ["oldwiki", "reallyoldwiki"],
						isPrimaryWiki: true,
						dbName: "db_mywiki",
					},
					{
						id: "mywiki2",
						isPrimaryWiki: true,
						dbName: "db_mywiki",
					},
					{
						id: "oldwiki",
						dbName: "db_mywiki",
					},
				],
				pathToWikis: "/path/to/wikis",
				mediawikiPath: "/path/to/mediawiki",

				mezaAuthType: "anon-edit",
				phpConfigPath: "/path/to/config",
				allowRequestDebug: false,
				wikiAppFqdn: "wiki.example.com",
				enableEmail: true,
				wgPasswordSender: "admin@example.com",
				wgEmergencyContact: "admin@example.com",
				wgSecretKey: "1234abc",
				rootWgCacheDirectory: "/path/to/cache",
				wgAllowExternalImages: true,
				wgAllowImageTag: true,
				wgLocaltimezone: "America/Chicago",

				dbMaster: "appserver.example.com",

				wikiAppDbPassword: "password1",
				wikiAppDbUser: "theuser",
				thisServer: "appserver.example.com",
				loadBalancers: ["lb1.example.com", "lb2.example.com"],
				memcachedServers: ["memcached1.example.com", "memcached2.example.com"],
				elasticsearchServers: [
					"es1.example.com",
					"es2.example.com",
					"es3.example.com",
				],
			})
		).toEqual([
			{
				errorType: "AppError",
				msg: `Tried to set mywiki2 as primary wiki when already set to mywiki`,
			},
			{
				errorType: "AppError",
				msg: `Wiki ID or redirect "oldwiki" found more than once`,
			},
		]);
	});

	// FIXME name
	test("handle no primary wiki and app server running services", async () => {
		expect(
			doLocalSettings({
				wikis: [
					{
						id: "mywiki",
						redirectsFrom: ["oldwiki", "reallyoldwiki"],
						dbName: "db_mywiki",
					},
				],
				pathToWikis: "/path/to/wikis",
				mediawikiPath: "/path/to/mediawiki",

				mezaAuthType: "user-edit",
				phpConfigPath: "/path/to/config",
				allowRequestDebug: false,
				wikiAppFqdn: "wiki.example.com",
				enableEmail: true,
				wgPasswordSender: "admin@example.com",
				wgEmergencyContact: "admin@example.com",
				wgSecretKey: "1234abc",
				rootWgCacheDirectory: "/path/to/cache",
				wgAllowExternalImages: true,
				wgAllowImageTag: true,
				wgLocaltimezone: "America/Chicago",

				dbMaster: "db-master.example.com",
				dbReplicas: [
					"appserver.example.com",
					"db-replica-1.example.com",
					"db-replica-2.example.com",
				],

				wikiAppDbPassword: "password1",
				wikiAppDbUser: "theuser",
				thisServer: "appserver.example.com",
				loadBalancers: [
					"appserver.example.com",
					"lb1.example.com",
					"lb2.example.com",
				],
				memcachedServers: [
					"appserver.example.com",
					"memcached1.example.com",
					"memcached2.example.com",
				],
				elasticsearchServers: [
					"appserver.example.com",
					"es2.example.com",
					"es3.example.com",
				],
			})
		).toEqual("nothing");
	});

	test("handle dev config and alternate settings", async () => {
		fs.writeFileSync(
			__dirname + "/localsettings.php",
			doLocalSettings({
				wikis: [
					{
						id: "mywiki",
						dbName: "db_mywiki",
					},
				],
				pathToWikis: "/path/to/wikis",
				mediawikiPath: "/path/to/mediawiki",

				mezaAuthType: "user-read",
				phpConfigPath: "/path/to/config",
				allowRequestDebug: true,
				wikiAppFqdn: "localhost",
				enableEmail: false,
				wgPasswordSender: "admin@example.com",
				wgEmergencyContact: "admin@example.com",
				wgSecretKey: "1234abc",
				rootWgCacheDirectory: "/path/to/cache",
				wgAllowExternalImages: false,
				wgAllowImageTag: false,
				wgLocaltimezone: "America/Chicago",

				dbMaster: "localhost",
				wikiAppDbPassword: "password1",
				wikiAppDbUser: "theuser",
				thisServer: "localhost",
				loadBalancers: ["localhost"],
				memcachedServers: ["localhost"],
				elasticsearchServers: ["localhost"],
			}) as string
		);
		expect(
			doLocalSettings({
				wikis: [
					{
						id: "mywiki",
						dbName: "db_mywiki",
					},
				],
				pathToWikis: "/path/to/wikis",
				mediawikiPath: "/path/to/mediawiki",

				mezaAuthType: "user-read",
				phpConfigPath: "/path/to/config",
				allowRequestDebug: true,
				wikiAppFqdn: "localhost",
				enableEmail: false,
				wgPasswordSender: "admin@example.com",
				wgEmergencyContact: "admin@example.com",
				wgSecretKey: "1234abc",
				rootWgCacheDirectory: "/path/to/cache",
				wgAllowExternalImages: false,
				wgAllowImageTag: false,
				wgLocaltimezone: "America/Chicago",

				dbMaster: "localhost",
				wikiAppDbPassword: "password1",
				wikiAppDbUser: "theuser",
				thisServer: "localhost",
				loadBalancers: ["localhost"],
				memcachedServers: ["localhost"],
				elasticsearchServers: ["localhost"],
			})
		).toEqual("nothing");
	});
});

describe("doPermissions()", () => {
	test("handle viewer-read permissions", async () => {
		expect(doPermissions({ mezaAuthType: "viewer-read" })).toEqual(`/**
 *  7) PERMISSIONS
 *
 *
 *
 **/
# Prevent new user registrations except by sysops
$wgGroupPermissions['*']['createaccount'] = false;

// no anonymous or ordinary users
$wgGroupPermissions['*']['read'] = false;
$wgGroupPermissions['*']['edit'] = false;
$wgGroupPermissions['user']['read'] = false;
$wgGroupPermissions['user']['edit'] = false;

// create the Viewer group with read permissions
$wgGroupPermissions['Viewer'] = $wgGroupPermissions['user'];
$wgGroupPermissions['Viewer']['read'] = true;
$wgGroupPermissions['Viewer']['talk'] = true;

// also explicitly give sysop read since you otherwise end up with
// a chicken/egg situation prior to giving people Viewer
$wgGroupPermissions['sysop']['read'] = true;

// Create a contributors group that can edit
$wgGroupPermissions['Contributor'] = $wgGroupPermissions['user'];
$wgGroupPermissions['Contributor']['edit'] = true;`);
	});

	test("handle 'none' permissions", async () => {
		expect(doPermissions({ mezaAuthType: "none" })).toEqual("");
	});
	test("handle anon-edit permissions", async () => {
		expect(doPermissions({ mezaAuthType: "anon-edit" })).toEqual(`/**
 *  7) PERMISSIONS
 *
 *
 *
 **/
# Prevent new user registrations except by sysops
$wgGroupPermissions['*']['createaccount'] = false;

// allow anonymous read
$wgGroupPermissions['*']['read'] = true;
$wgGroupPermissions['user']['read'] = true;

// allow anonymous write
$wgGroupPermissions['*']['edit'] = true;
$wgGroupPermissions['user']['edit'] = true;`);
	});
});

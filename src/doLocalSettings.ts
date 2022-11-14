import dedent from "dedent-js";
import { verifyAllUnique } from "./util";

/**
 * Either return the server name provided or provide 127.0.0.1 if server is localhost or 127.0.0.1
 *
 * @param server name of the server you're checking or 127.0.0.1
 * @returns
 */
const serverOrLocalhost = (server: string): string => {
	return server === "localhost" || server === "127.0.0.1"
		? "127.0.0.1"
		: server;
};

const doIntro = () => {
	return dedent`
		<?php

		# Protect against web entry
		if ( !defined( 'MEDIAWIKI' ) ) {
			exit;
		}

		/**
		 *  TABLE OF CONTENTS
		 *
		 *    1) WIKI-SPECIFIC SETUP
		 *    2) (RESERVED)
		 *    3) PATH SETUP
		 *    4) (RESERVED)
		 *    5) DATABASE SETUP
		 *    6) GENERAL CONFIGURATION
		 *    7) (RESERVED)
		 *    8) EXTENSION SETTINGS
		 *    9) LOAD POST LOCAL SETTINGS
		 *
		 **/`;
};

const doRedirects = (wikis: WikiConfig[]) => {
	// const allRedirects: Record<string, string> = {};
	const allRedirects: { redirect: string; id: string }[] = [];
	for (const wiki of wikis) {
		if (wiki.redirectsFrom) {
			for (const redirect of wiki.redirectsFrom) {
				allRedirects.push({ redirect, id: wiki.id });
			}
		}
	}

	if (!Object.keys(allRedirects).length) {
		return "";
	}

	return dedent`
		// array point wiki IDs to redirect from and to
		$wikiIdRedirects = [
			${allRedirects.map((r) => `'${r.redirect}' => '${r.id}'`).join(",\n\t")}
		];

		// check if current wiki ID is a key in this array, and thus should redirect to another wiki
		if ( isset( $wikiIdRedirects[ $wikiId ] ) ) {

			$newURI = preg_replace(
				"/^\\/([\\w\\d-_]+)/",
				'/' . $wikiIdRedirects[$wikiId],
				$_SERVER['REQUEST_URI']
			);

			// Redirect to target wiki with 301 code
			header( 'Location: https://' . $_SERVER['HTTP_HOST'] . $newURI , true, 301 );
			exit;
		}
		`;
};

const doWikiSpecificSetup = ({
	wikis,
	appMoreConfigPath,
}: PlatformConfig): string => {
	const redirects = doRedirects(wikis);

	return dedent`
		/**
		 *  1) WIKI-SPECIFIC SETUP
		 *
		 *  Acquire the intended wiki either from the REQUEST_URI (for web requests) or
		 *  from the WIKI environment variable (for command line scripts)
		 **/
		if( $wgCommandLineMode ) {

			// get $wikiId from environment variable WIKI
			$wikiId = getenv( 'WIKI' );

		}
		else {

			// get $wikiId from URI
			$uriParts = explode( '/', $_SERVER['REQUEST_URI'] );
			$wikiId = strtolower( $uriParts[1] ); // URI has leading slash, so $uriParts[0] is empty string

		}

		${redirects}

		$mezaWikis = [
			${wikis
				.map(({ id, sitename }) => {
					return `'${id}' => ['sitename' => '${sitename}']`;
				})
				.join(",\n")}
		];

		if ( ! isset( $mezaWikis[$wikiId] ) ) {

			// handle invalid wiki
			http_response_code(404);
			die( "No wiki found with ID \\"$wikiId\\"\\n" );

		}

		$wgSitename = $mezaWikis[$wikiId]['sitename'];

		#
		# PRE LOCAL SETTINGS
		#
		#    (1) Load all PHP files in preLocalSettings.d for all wikis
		foreach ( glob("${appMoreConfigPath}/preLocalSettings.d/*.php") as $filename) {
			require_once $filename;
		}
		#    (2) Load all PHP files in preLocalSettings.d for this wiki
		foreach ( glob("${appMoreConfigPath}/wikis/$wikiId/preLocalSettings.d/*.php") as $filename) {
			require_once $filename;
		}`;
};

const doPathSetup = ({
	wikiAppFqdn,
	appUploadsDirectory,
}: Pick<PlatformConfig, "wikiAppFqdn" | "appUploadsDirectory">) => {
	return dedent`
		/**
		 *  3) PATH SETUP
		 *
		 *
		 **/

		// ref: https://www.mediawiki.org/wiki/Manual:$wgServer
		//   From section #Autodetection:
		//     "When $wgServer is not set, the default value is calculated
		//     automatically. Some web servers end up returning silly defaults or
		//     internal names which aren't what you want..."
		//
		// Depending on proxy setup (particularly for Varnish/Squid caching) may need
		// to set $wgInternalServer:
		// ref: https://www.mediawiki.org/wiki/Manual:$wgInternalServer
		$wgServer = 'https://${wikiAppFqdn}';

		// https://www.mediawiki.org/wiki/Manual:$wgScriptPath
		$wgScriptPath = "/$wikiId";

		// https://www.mediawiki.org/wiki/Manual:$wgUploadPath
		$wgUploadPath = "$wgScriptPath/img_auth.php";

		// https://www.mediawiki.org/wiki/Manual:$wgUploadDirectory
		$wgUploadDirectory = "${appUploadsDirectory}/$wikiId";

		// https://www.mediawiki.org/wiki/Manual:$wgLogo
		$wgLogo = "/wikis/$wikiId/config/logo.png";

		// https://www.mediawiki.org/wiki/Manual:$wgFavicon
		$wgFavicon = "/wikis/$wikiId/config/favicon.ico";

		// https://www.mediawiki.org/wiki/Manual:$wgMetaNamespace
		$wgMetaNamespace = str_replace( ' ', '_', $wgSitename );

		$wgScriptExtension = ".php";

		## The relative URL path to the skins directory
		$wgStylePath = "$wgScriptPath/skins";
		$wgResourceBasePath = $wgScriptPath;`;
};

const doDatabase = ({
	dbMaster,
	dbReplicas,
	wikis,
}: Pick<PlatformConfig, "wikis" | "dbMaster" | "dbReplicas">) => {
	let primaryWiki: PrimaryWiki | undefined;
	for (const wiki of wikis) {
		if (wiki.isPrimaryWiki) {
			primaryWiki = wiki;
		}
	}

	const primaryWikiConfig = primaryWiki
		? dedent`
		/**
		 *  Primary Wiki ${primaryWiki.id} with database name ${primaryWiki.dbName}
		 *
		 *  If a primewiki is defined then every wiki will use that wiki db for certain
		 *  tables. The shared 'interwiki' table allows users to use the same interwiki
		 *  prefixes across all wikis. The 'user' and 'user_properties' tables make all
		 *  wikis have the same set of users and user properties/preferences. This does
		 *  not affect the user groups, so a user can be a sysop on one wiki and just a
		 *  user on another.
		 *
		 *  To enable a primewiki add the 'primary_wiki_id' variable to the config with
		 *  the value being the wiki ID of the prime wiki (e.g. the 1st part of the URL
		 *  after the domain, e.g. https://example.com/<wiki_id>)
		 *
		 *  In order for this to work properly the wikis need to have been created with
		 *  a single user table in mind. If you're starting a new wiki farm then you're
		 *  all set. If you're importing wikis which didn't previously have shared user
		 *  tables, then you'll need to use the unifyUserTables.php script. Please test
		 *  this script extensively before use. Unifying user tables is complicated.
		 **/
		$wgSharedDB = '${primaryWiki.dbName}';
		$wgSharedTables = array(
			'user',            // default
			'user_properties', // default
			'interwiki',       // additional
		);
		`
		: "";

	const allDbServers = [dbMaster, ...(dbReplicas || [])];

	const appDbPassword = process.env.APP_DB_PASSWORD;
	const appDbUser = process.env.APP_DB_USER;

	if (!appDbPassword) {
		throw new Error("Must set environment variable APP_DB_PASSWORD");
	}
	if (!appDbUser) {
		throw new Error("Must set environment variable APP_DB_USER");
	}

	return dedent`
		/**
		 *  5) DATABASE SETUP
		 *
		 *
		 **/
		$mezaDatabaseServers = [
			${allDbServers
				.map((server) => "'" + serverOrLocalhost(server) + "'")
				.join(",\n\t")}
		];

		$mezaDatabasePassword = '${appDbPassword}';
		$mezaDatabaseUser = '${appDbUser}';

		$mezaWikiDatabases = [
			${wikis.map((wiki) => `'${wiki.id}' => '${wiki.dbName}'`).join(",\n")}
		];

		// even though using $wgDBservers method below, keep $wgDBname per warning in:
		// https://www.mediawiki.org/wiki/Manual:$wgDBservers
		$wgDBname = $mezaWikiDatabases[$wikiId];

		// first server in list, master, gets a value of 1. If it's the only server, it
		// will get 100% of the load. If there is one replica, it will get a value of 10
		// and thus will take ~90% of the read-load (master will take ~10%). If there
		// are X replicas, master will take 1/(1+10X) of the load. This causes master to
		// get very little of the load, but in the case that all the replicas fail master
		// still is configured to pick up the entirety of the read-load.
		//
		// FIXME #821: Make load configurable.
		$databaseReadLoadRatio = 1;

		$wgDBservers = array();
		foreach( $mezaDatabaseServers as $databaseServer ) {
			$wgDBservers[] = array(
				'host' => $databaseServer,
				'dbname' => $wgDBname,
				'user' => $mezaDatabaseUser,
				'password' => $mezaDatabasePassword,
				'type' => "mysql",
				'flags' => DBO_DEFAULT,
				'load' => $databaseReadLoadRatio,
			);
			$databaseReadLoadRatio = 10; // every server after the first gets the same loading
		}


		# MySQL specific settings
		$wgDBprefix = "";

		# MySQL table options to use during installation or update
		$wgDBTableOptions = "ENGINE=InnoDB, DEFAULT CHARSET=binary";

		${primaryWikiConfig}
		`;
};

const doGeneralConfig = ({
	loadBalancers,
	memcachedServers,
	appCacheDirectory,
}: Pick<
	PlatformConfig,
	"loadBalancers" | "memcachedServers" | "appCacheDirectory"
>) => {
	const wgSecretKey = process.env.WG_SECRET_KEY;

	if (!wgSecretKey) {
		throw new Error("Must set environment variable WG_SECRET_KEY");
	}

	return dedent`
		/**
		 *  6) GENERAL CONFIGURATION
		 *
		 *
		 *
		 **/
		// proxy setup
		$wgUseCdn = true;
		$wgUsePrivateIPs = true;
		$wgCdnServersNoPurge = [
		${loadBalancers
			.map((server) => {
				const s = serverOrLocalhost(server);
				return "\t'" + s + "'";
			})
			.join(",\n")}
		];

		// memcached settings
		$wgMainCacheType = CACHE_MEMCACHED;
		// If parser cache set to CACHE_MEMCACHED, templates used to format SMW query
		// results in generic footer don't work. This is a limitation of
		// Extension:HeaderFooter which may or may not be able to be worked around.
		$wgParserCacheType = CACHE_NONE;
		$wgMessageCacheType = CACHE_MEMCACHED;
		$wgMemCachedServers = [
		${memcachedServers
			.map((server) => {
				const s = serverOrLocalhost(server);
				return `\t'${s}:11211'`;
			})
			.join(",\n")}
		];

		// memcached is setup and will work for sessions with meza, unless you use
		// SimpleSamlPhp. Previous versions of meza had this set to CACHE_NONE, but
		// MW 1.27 requires a session cache. Setting this to CACHE_MEMCACHED as it
		// is the ultimate goal. A separate branch contains pulling PHP from the
		// IUS repository, which should simplify integrating PHP and memcached in a
		// way that SimpleSamlPhp likes. So this may be temporarily breaking for
		// SAML, but MW 1.27 may be breaking for SAML anyway due to changes in
		// AuthPlugin/AuthManager.
		$wgSessionCacheType = CACHE_MEMCACHED;

		$wgUseImageMagick = true;
		$wgImageMagickConvertCommand = "/usr/bin/convert";

		## If you want to use image uploads under safe mode,
		## create the directories images/archive, images/thumb and
		## images/temp, and make them all writable. Then uncomment
		## this, if it's not already uncommented:
		$wgHashedUploadDirectory = true;

		# https://www.mediawiki.org/wiki/Manual:$wgSecretKey
		$wgSecretKey = '${wgSecretKey}';

		# Path to the GNU diff3 utility. Used for conflict resolution.
		$wgDiff3 = "/usr/bin/diff3";

		/**
		 * Directory for caching data in the local filesystem. Should not be accessible
		 * from the web. Meza's usage of this is for localization cache
		 *
		 * Note: if multiple wikis share the same localisation cache directory, they
		 * must all have the same set of extensions.
		 *
		 * Refs:
		 *  - mediawiki/includes/DefaultSettings.php
		 *  - https://www.mediawiki.org/wiki/Localisation#Caching
		 *  - https://www.mediawiki.org/wiki/Manual:$wgCacheDirectory
		 *  - https://www.mediawiki.org/wiki/Manual:$wgLocalisationCacheConf
		 */
		$wgCacheDirectory = "${appCacheDirectory}/$wikiId";`;
};

const doExtensionsSettings = ({
	appMediawikiPath,
	elasticsearchServers,
}: Pick<PlatformConfig, "appMediawikiPath" | "elasticsearchServers">) => {
	return dedent`
		/**
		 *  8) EXTENSION SETTINGS
		 *
		 *  Load separate file that includes all extensions to be loaded
		 */

		require_once "${appMediawikiPath}/extensions/ExtensionSettings.php";


		/**
		 * Extension:CirrusSearch
		 *
		 * CirrusSearch cluster(s) need to be referenced, which is easier to do here rather than in
		 * the CirrusSearch config in ExtensionSettings.php
		 */
		$wgSearchType = 'CirrusSearch';
		$wgCirrusSearchClusters['default'] = [
			${elasticsearchServers
				.map((server) => {
					return "'" + serverOrLocalhost(server) + "'";
				})
				.join(",\n\t")}
		];
		$wgCirrusSearchWikimediaExtraPlugin['id_hash_mod_filter'] = true;
		`;
};

const doLoadOverrides = ({
	appMoreConfigPath,
}: Pick<PlatformConfig, "appMoreConfigPath">) => {
	return dedent`
		/**
		 *  9) LOAD POST LOCAL SETTINGS
		 *
		 *     Items to override standard config
		 *
		 *
		 **/
		#    (1) Load all PHP files in postLocalSettings.d for all wikis
		foreach ( glob("${appMoreConfigPath}/postLocalSettings.d/*.php") as $filename) {
			require_once $filename;
		}
		#    (2) Load all PHP files in postLocalSettings.d for this wiki
		foreach ( glob("${appMoreConfigPath}/wikis/$wikiId/postLocalSettings.d/*.php") as $filename) {
			require_once $filename;
		}`;
};

const validateWikis = (
	wikis: WikiConfig[]
): undefined | { errors: AppError[] } => {
	const idsAndRedirects: string[] = [];

	let primaryWiki: string | undefined;
	const errObject: { errors: AppError[] } = { errors: [] };

	for (const wiki of wikis) {
		idsAndRedirects.push(wiki.id);
		if (wiki.redirectsFrom) {
			idsAndRedirects.push(...wiki.redirectsFrom);
		}

		if (wiki.isPrimaryWiki && primaryWiki) {
			errObject.errors.push({
				errorType: "AppError",
				msg: `Tried to set ${wiki.id} as primary wiki when already set to ${primaryWiki}`,
			});
		} else {
			primaryWiki = wiki.id;
		}
	}

	const uniqueErrors = verifyAllUnique(idsAndRedirects);
	if (uniqueErrors) {
		errObject.errors.push(...uniqueErrors);
	}

	if (errObject.errors.length) {
		return errObject;
	}
};

const doLocalSettings = (
	config: PlatformConfig
): string | { errors: AppError[] } => {
	const { wikis } = config;

	const err = validateWikis(wikis);
	if (err && err.errors.length) {
		return { errors: err.errors };
	}

	return [
		doIntro(),
		doWikiSpecificSetup(config),
		doPathSetup(config),
		doDatabase(config),
		doGeneralConfig(config),
		doExtensionsSettings(config),
		doLoadOverrides(config),
	].join("\n\n\n");
};
export default doLocalSettings;

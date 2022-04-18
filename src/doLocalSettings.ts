import dedent from "dedent-js";

// fixme use this other places
// fixme docs
const serverOrLocalhost = (server: string, thisServer: string): string => {
	return server === thisServer || server === "localhost" ? "127.0.0.1" : server;
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
		 *    2) DEBUG
		 *    3) PATH SETUP
		 *    4) EMAIL
		 *    5) DATABASE SETUP
		 *    6) GENERAL CONFIGURATION
		 *    7) PERMISSIONS
		 *    8) EXTENSION SETTINGS
		 *    9) LOAD OVERRIDES
		 *
		 **/`;
};

// move totypes.d.ts fixme
type AppError = {
	errorType: "AppError";
	msg: string;
};

type WikiConfig = {
	id: string;
	redirectsFrom?: string[];
	isPrimaryWiki?: boolean;
	dbName: string;
};

type PrimaryWiki = { id: string; dbName: string };

type MezaAuthType =
	| "none"
	| "anon-read"
	| "anon-edit"
	| "user-edit"
	| "user-read"
	| "viewer-read";

type PlatformConfig = {
	wikis: WikiConfig[];
	pathToWikis: string; // fixme from which server/container?
	mediawikiPath: string;

	mezaAuthType: MezaAuthType;
	phpConfigPath: string;
	allowRequestDebug: boolean;
	wikiAppFqdn: string;
	enableEmail: boolean;
	wgPasswordSender: string;
	wgEmergencyContact: string;
	wgSecretKey: string; // FIXME make this env var
	rootWgCacheDirectory: string;
	wgAllowExternalImages: boolean;
	wgAllowImageTag: boolean;
	wgLocaltimezone: string;

	dbMaster: string;
	dbReplicas?: string[];

	wikiAppDbPassword: string; // FIXME make this env var
	wikiAppDbUser: string; // FIXME make this env var
	thisServer: string; // name fixme
	loadBalancers: string[];
	memcachedServers: string[];
	elasticsearchServers: string[];
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
	pathToWikis,
	mezaAuthType,
	phpConfigPath,
}: PlatformConfig): string => {
	const redirects = doRedirects(wikis);

	// FIXME standardize wikiId....something built into MediaWiki now?

	return dedent`
		/**
		 *  1) WIKI-SPECIFIC SETUP
		 *
		 *  Acquire the intended wiki either from the REQUEST_URI (for web requests) or
		 *  from the WIKI environment variable (for command line scripts)
		 **/
		if( $wgCommandLineMode ) {

			$mezaWikiEnvVarName='WIKI';

			// get $wikiId from environment variable
			$wikiId = getenv( $mezaWikiEnvVarName );

		}
		else {

			// get $wikiId from URI
			$uriParts = explode( '/', $_SERVER['REQUEST_URI'] );
			$wikiId = strtolower( $uriParts[1] ); // URI has leading slash, so $uriParts[0] is empty string

		}

		${redirects}

		// get all directory names in /wikis, minus the first two: . and ..
		$wikis = array_slice( scandir( "${pathToWikis}" ), 2 );


		if ( ! in_array( $wikiId, $wikis ) ) {

			// handle invalid wiki
			http_response_code(404);
			die( "No wiki found with ID \\"$wikiId\\"\\n" );

		}

		// Set an all-wiki auth type, which individual wikis can override
		$mezaAuthType = '${mezaAuthType}';

		#
		# PRE LOCAL SETTINGS
		#
		#    (1) Load all PHP files in preLocalSettings.d for all wikis
		foreach ( glob("${phpConfigPath}/preLocalSettings.d/*.php") as $filename) {
			require_once $filename;
		}
		#    (2) Load all PHP files in preLocalSettings.d for this wiki
		foreach ( glob("${phpConfigPath}/wikis/$wikiId/preLocalSettings.d/*.php") as $filename) {
			require_once $filename;
		}`;
};

const doDebug = ({ allowRequestDebug }: { allowRequestDebug: boolean }) => {
	const requestDebug = allowRequestDebug
		? dedent`
		// allows appending ?requestDebug=true to any URL to see debug. Disable this in production
		elseif ( isset( $_GET['requestDebug'] ) ) {
			$debug = true;
		}
		`
		: "";

	return dedent`
		/**
		 *  2) DEBUG
		 *
		 *  Options to enable debug are below. The lowest-impact solution should be
		 *  chosen. Options are listed from least impact to most impact.
		 *    1) Add to the URI you're requesting requestDebug=true to enable debug
		 *       for just that request.
		 *    2) Set $mezaCommandLineDebug = true; for debug on the command line.
		 *       This is the default, which can be overriden in preLocalSettings_allWiki.php.
		 *    5) Set $mezaForceDebug = true; to turn on debug for all users and wikis
		 **/
		$mezaCommandLineDebug = true; // always want debug on command line
		$mezaForceDebug = false; // this is here to be able to alter LocalSettings


		if ( $mezaForceDebug ) {
			$debug = true;
		}

		elseif ( $wgCommandLineMode && $mezaCommandLineDebug ) {
			$debug = true;
		}
		${requestDebug ? "\n" + requestDebug + "\n" : ""}
		else {
			$debug = false;
		}


		if ( $debug ) {

			// turn error logging on
			error_reporting( -1 );
			ini_set( 'display_errors', 1 );
			ini_set( 'log_errors', 1 );

			// Output errors to log file
			ini_set( 'error_log', "$m_meza_data/logs/php/php_errors.log" );


			// Displays debug data at the bottom of the content area in a formatted
			// list below a horizontal line.
			$wgShowDebug = true;

			// A more elaborative debug toolbar with interactive panels.
			$wgDebugToolbar = true;

			// Uncaught exceptions will print a complete stack trace to output (instead
			// of just to logs)
			$wgShowExceptionDetails = true;

			// SQL statements are dumped to the $wgDebugLogFile (if set) /and/or to
			// HTML output (if $wgDebugComments is true)
			$wgDebugDumpSql  = true;

			// If on, some debug items may appear in comments in the HTML output.
			$wgDebugComments = false;

			// The file name of the debug log, or empty if disabled. wfDebug() appends
			// to this file.
			$wgDebugLogFile = "/opt/data-meza/logs/mw-debug.log";

			// If true, show a backtrace for database errors.
			$wgShowDBErrorBacktrace = true;

			// Shows the actual query when errors occur (in HTML, I think. Not logs)
			$wgShowSQLErrors = true;

		}

		// production: no error reporting
		else {

			error_reporting(0);
			ini_set("display_errors", 0);

		}`;
};

const doPathSetup = ({ wikiAppFqdn }: Pick<PlatformConfig, "wikiAppFqdn">) => {
	// @todo: handle auth type from preLocalSettings.php
	// @todo: handle debug from preLocalSettings_allWikis.php

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
		$wgUploadDirectory = "{{ m_uploads_dir }}/$wikiId";

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

const doEmail = ({
	enableEmail,
	wgPasswordSender,
	wgEmergencyContact,
}: Pick<
	PlatformConfig,
	"enableEmail" | "wgPasswordSender" | "wgEmergencyContact"
>) => {
	const globalEnabled = enableEmail
		? dedent`
			if ( isset( $mezaEnableWikiEmail ) && $mezaEnableWikiEmail ) {
				$wgEnableEmail = true;
			}
			else {
				$wgEnableEmail = false;
			}
			`
		: "$wgEnableEmail = false;";

	return dedent`
		/**
		 *  4) EMAIL
		 *
		 *  Email configuration
		 **/
		${globalEnabled}

		## UPO means: this is also a user preference option
		$wgEnableUserEmail = $wgEnableEmail; # UPO
		$wgEnotifUserTalk = $wgEnableEmail; # UPO
		$wgEnotifWatchlist = $wgEnableEmail; # UPO
		$wgEmailAuthentication = $wgEnableEmail;

		$wgPasswordSender = '${wgPasswordSender}';
		$wgEmergencyContact = '${wgEmergencyContact}';
		`;
};

const doDatabase = ({
	dbMaster, // $databaseServer === $mezaThisServer ?: $databaseServer = 'localhost';
	dbReplicas,
	wikiAppDbPassword,
	wikiAppDbUser,
	thisServer, // FIXME
	wikis,
}: Pick<
	PlatformConfig,
	| "wikis"
	| "dbMaster"
	| "dbReplicas"
	| "wikiAppDbPassword"
	| "wikiAppDbUser"
	| "thisServer"
>) => {
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

	return dedent`
		/**
		 *  5) DATABASE SETUP
		 *
		 *
		 **/
		$mezaDatabaseServers = [
			${allDbServers
				.map((server) => "'" + serverOrLocalhost(server, thisServer) + "'")
				.join(",\n\t")}
		];

		$mezaDatabasePassword = '${wikiAppDbPassword}';
		$mezaDatabaseUser = '${wikiAppDbUser}';
		$mezaThisServer = '${thisServer}';

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
			if ( $databaseServer === $mezaThisServer ) {
				$databaseServer = 'localhost';
			}
			$wgDBservers[] = array(
				'host' => $databaseServer,
				'dbname' => $wgDBname,
				'user' => $mezaDatabaseUser,
				'password' => $mezaDatabasePassword,
				'type' => "mysql",
				'flags' => $debug ? DBO_DEFAULT | DBO_DEBUG : DBO_DEFAULT,
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
	thisServer,
	wgSecretKey,
	rootWgCacheDirectory,
	wgAllowExternalImages,
	wgAllowImageTag,
	wgLocaltimezone,
}: Pick<
	PlatformConfig,
	| "thisServer"
	| "loadBalancers"
	| "memcachedServers"
	| "wgSecretKey"
	| "rootWgCacheDirectory"
	| "wgAllowExternalImages"
	| "wgAllowImageTag"
	| "wgLocaltimezone"
>) => {
	// FIXME if loadBalancers && loadBalancers.length, do proxy stuff, else don't do wgUseCdn, etc
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
				const s = serverOrLocalhost(server, thisServer);
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
				const s = serverOrLocalhost(server, thisServer);
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

		## To enable image uploads, make sure the 'images' directory
		## is writable, then set this to true:
		$wgEnableUploads = true;
		$wgMaxUploadSize = 1024*1024*100; // 100 MB
		$wgUseImageMagick = true;
		$wgImageMagickConvertCommand = "/usr/bin/convert";

		# InstantCommons allows wiki to use images from http://commons.wikimedia.org
		$wgUseInstantCommons = false;

		## If you use ImageMagick (or any other shell command) on a
		## Linux server, this will need to be set to the name of an
		## available UTF-8 locale
		$wgShellLocale = "en_US.utf8";

		## If you want to use image uploads under safe mode,
		## create the directories images/archive, images/thumb and
		## images/temp, and make them all writable. Then uncomment
		## this, if it's not already uncommented:
		$wgHashedUploadDirectory = true;

		## Set $wgCacheDirectory to a writable directory on the web server
		## to make your wiki go slightly faster. The directory should not
		## be publically accessible from the web.
		#$wgCacheDirectory = "$IP/cache";

		# Site language code, should be one of the list in ./languages/Names.php
		$wgLanguageCode = "en";

		# https://www.mediawiki.org/wiki/Manual:$wgSecretKey
		$wgSecretKey = '${wgSecretKey}';

		## For attaching licensing metadata to pages, and displaying an
		## appropriate copyright notice / icon. GNU Free Documentation
		## License and Creative Commons licenses are supported so far.
		$wgRightsPage = ""; # Set to the title of a wiki page that describes your license/copyright
		$wgRightsUrl = "";
		$wgRightsText = "";
		$wgRightsIcon = "";

		# Path to the GNU diff3 utility. Used for conflict resolution.
		$wgDiff3 = "/usr/bin/diff3";

		## Default skin: you can change the default skin. Use the internal symbolic
		## names, ie 'vector', 'monobook': see MezaCoreSkins.yml for choices.
		$wgDefaultSkin = "vector";

		// allows users to remove the page title.
		// https://www.mediawiki.org/wiki/Manual:$wgRestrictDisplayTitle
		$wgRestrictDisplayTitle = false;


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
		$wgCacheDirectory = "${rootWgCacheDirectory}/$wikiId";

		// opens external links in new window
		$wgExternalLinkTarget = '_blank';

		// added this line to allow linking. specifically to Imagery Online.
		$wgAllowExternalImages = ${wgAllowExternalImages ? "true" : "false"};
		$wgAllowImageTag = ${wgAllowImageTag ? "true" : "false"};

		$wgVectorUseSimpleSearch = true;

		//$wgDefaultUserOptions['useeditwarning'] = 1;

		// disable page edit warning (edit warning affect Semantic Forms)
		$wgVectorFeatures['editwarning']['global'] = false;

		$wgDefaultUserOptions['rememberpassword'] = 1;

		// users watch pages by default (they can override in settings)
		$wgDefaultUserOptions['watchdefault'] = 1;
		$wgDefaultUserOptions['watchmoves'] = 1;
		$wgDefaultUserOptions['watchdeletion'] = 1;
		$wgDefaultUserOptions['watchcreations'] = 1;

		// fixes login issue for some users (login issue fixed in MW version 1.18.1 supposedly)
		$wgDisableCookieCheck = true;

		#Set Default Timezone
		$wgLocaltimezone = '${wgLocaltimezone}';
		$oldtz = getenv("TZ");
		putenv("TZ=$wgLocaltimezone");

		$wgMaxImageArea = 1.25e10; // Images on [[Snorkel]] fail without this
		// $wgMemoryLimit = 500000000; //Default is 50M. This is 500M.

		// Increase from default setting for large form
		// See https://www.mediawiki.org/wiki/Extension_talk:Semantic_Forms/Archive_April_to_June_2012#Error:_Backtrace_limit_exceeded_during_parsing
		// If set to 10million, errors are seen when using Edit with form on mission pages like 41S
		// ini_set( 'pcre.backtrack_limit', 10000000 ); //10million
		ini_set( 'pcre.backtrack_limit', 1000000000 ); //1 billion

		// Allowed file types
		$wgFileExtensions = array(
			'aac',
			'bmp',
			'docx',
			'gif',
			'jpg',
			'jpeg',
			'mpp',
			'mp3',
			'msg',
			'odg',
			'odp',
			'ods',
			'odt',
			'pdf',
			'png',
			'pptx',
			'ps',
			'svg',
			'tiff',
			'txt',
			'xlsx',
			'zip'
		);

		// Tell Universal Language Selector not to try to guess language based upon IP
		// address. This (a) isn't likely needed in enterprise use cases and (b) fails
		// anyway due to outdated URLs or firewall rules.
		$wgULSGeoService = false;

		$wgNamespacesWithSubpages[NS_MAIN] = true;

		$wgUseRCPatrol = false;`;
};

export const doPermissions = ({
	mezaAuthType,
}: Pick<PlatformConfig, "mezaAuthType">): string => {
	if (mezaAuthType === "none") {
		return "";
	}

	const intro = dedent`
		/**
		 *  7) PERMISSIONS
		 *
		 *
		 *
		 **/
		# Prevent new user registrations except by sysops
		$wgGroupPermissions['*']['createaccount'] = false;
		`;

	let perms: string;
	if (mezaAuthType === "anon-edit") {
		perms = `
			// allow anonymous read
			$wgGroupPermissions['*']['read'] = true;
			$wgGroupPermissions['user']['read'] = true;

			// allow anonymous write
			$wgGroupPermissions['*']['edit'] = true;
			$wgGroupPermissions['user']['edit'] = true;`;
	} else if (mezaAuthType === "anon-read") {
		perms = `
			// allow anonymous read
			$wgGroupPermissions['*']['read'] = true;
			$wgGroupPermissions['user']['read'] = true;

			// do not allow anonymous write (must be registered user)
			$wgGroupPermissions['*']['edit'] = false;
			$wgGroupPermissions['user']['edit'] = true;`;
	} else if (mezaAuthType === "user-edit") {
		perms = `
			// no anonymous
			$wgGroupPermissions['*']['read'] = false;
			$wgGroupPermissions['*']['edit'] = false;

			// users read and write
			$wgGroupPermissions['user']['read'] = true;
			$wgGroupPermissions['user']['edit'] = true;`;
	} else if (mezaAuthType === "user-read") {
		perms = `
			// no anonymous
			$wgGroupPermissions['*']['read'] = false;
			$wgGroupPermissions['*']['edit'] = false;

			// users read NOT write, but can talk
			$wgGroupPermissions['user']['read'] = true;
			$wgGroupPermissions['user']['edit'] = false;
			$wgGroupPermissions['user']['talk'] = true;

			$wgGroupPermissions['Contributor'] = $wgGroupPermissions['user'];
			$wgGroupPermissions['Contributor']['edit'] = true;`;
	} else {
		// mezaAuthType === "viewer-read"
		perms = `
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
			$wgGroupPermissions['Contributor']['edit'] = true;`;
	}

	return intro + "\n\n" + dedent(perms);
};

const doExtensionsSettings = ({
	mediawikiPath,
	thisServer,
	elasticsearchServers,
}: Pick<
	PlatformConfig,
	"mediawikiPath" | "thisServer" | "elasticsearchServers"
>) => {
	return dedent`
		/**
		 *  8) EXTENSION SETTINGS
		 *
		 *  Extensions defined in meza core and meza local yaml files, which are used to  *  load the extensions via Git or Composer, and which generate the PHP files
		 *  below.
		 */

		require_once "${mediawikiPath}/extensions/ExtensionSettings.php";


		/**
		 * Extension:CirrusSearch
		 *
		 * CirrusSearch cluster(s) are defined based upon Ansible hosts file and thus
		 * cannot be easily added to base-extensions.yml. As such, CirrusSearch config
		 * is included directly in LocalSettings.php.j2
		 */
		$wgSearchType = 'CirrusSearch';
		$wgCirrusSearchClusters['default'] = [
			${elasticsearchServers
				.map((server) => {
					return "'" + serverOrLocalhost(server, thisServer) + "'";
				})
				.join(",\n\t")}
		];
		$wgCirrusSearchWikimediaExtraPlugin['id_hash_mod_filter'] = true;
		`;
};

const doLoadOverrides = ({
	phpConfigPath,
}: Pick<PlatformConfig, "phpConfigPath">) => {
	return dedent`
		/**
		 *  9) LOAD POST LOCAL SETTINGS
		 *
		 *     Items to override standard config
		 *
		 *
		 **/
		#    (1) Load all PHP files in postLocalSettings.d for all wikis
		foreach ( glob("${phpConfigPath}/postLocalSettings.d/*.php") as $filename) {
			require_once $filename;
		}
		#    (2) Load all PHP files in postLocalSettings.d for this wiki
		foreach ( glob("${phpConfigPath}/wikis/$wikiId/postLocalSettings.d/*.php") as $filename) {
			require_once $filename;
		}`;
};

const verifyAllUnique = (arr: string[]): undefined | AppError[] => {
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

const validateWikis = (wikis: WikiConfig[]): undefined | AppError[] => {
	const idsAndRedirects: string[] = [];

	let primaryWiki: string | undefined;
	const errors: AppError[] = [];

	for (const wiki of wikis) {
		idsAndRedirects.push(wiki.id);
		if (wiki.redirectsFrom) {
			idsAndRedirects.push(...wiki.redirectsFrom);
		}

		if (wiki.isPrimaryWiki && primaryWiki) {
			errors.push({
				errorType: "AppError",
				msg: `Tried to set ${wiki.id} as primary wiki when already set to ${primaryWiki}`,
			});
		} else {
			primaryWiki = wiki.id;
		}
	}

	const uniqueErrors = verifyAllUnique(idsAndRedirects);
	if (uniqueErrors) {
		errors.push(...uniqueErrors);
	}

	if (errors.length) {
		return errors;
	}
};

const doLocalSettings = (
	config: PlatformConfig
): string | { errors: AppError[] } => {
	const { allowRequestDebug, mezaAuthType, wikis } = config;

	const wikiErrors = validateWikis(wikis);
	if (wikiErrors) {
		return { errors: wikiErrors };
	}

	return [
		doIntro(),
		doWikiSpecificSetup(config),
		doDebug({ allowRequestDebug }),
		doPathSetup(config),
		doEmail(config),
		doDatabase(config),
		doGeneralConfig(config),
		doPermissions({ mezaAuthType }),
		doExtensionsSettings(config),
		doLoadOverrides(config),
	].join("\n\n\n");
};
export default doLocalSettings;

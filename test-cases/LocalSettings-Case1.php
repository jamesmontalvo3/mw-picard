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
 **/


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

// array point wiki IDs to redirect from and to
$wikiIdRedirects = [
	'oldwiki' => 'mywiki',
	'reallyoldwiki' => 'mywiki'
];

// check if current wiki ID is a key in this array, and thus should redirect to another wiki
if ( isset( $wikiIdRedirects[ $wikiId ] ) ) {

	$newURI = preg_replace(
		"/^\/([\w\d-_]+)/",
		'/' . $wikiIdRedirects[$wikiId],
		$_SERVER['REQUEST_URI']
	);

	// Redirect to target wiki with 301 code
	header( 'Location: https://' . $_SERVER['HTTP_HOST'] . $newURI , true, 301 );
	exit;
}

$mezaWikis = [
	'mywiki' => ['sitename' => 'My Wiki']
];

if ( ! isset( $mezaWikis[$wikiId] ) ) {

	// handle invalid wiki
	http_response_code(404);
	die( "No wiki found with ID \"$wikiId\"\n" );

}

$wgSitename = $mezaWikis[$wikiId]['sitename'];

#
# PRE LOCAL SETTINGS
#
#    (1) Load all PHP files in preLocalSettings.d for all wikis
foreach ( glob("/path/to/config/preLocalSettings.d/*.php") as $filename) {
	require_once $filename;
}
#    (2) Load all PHP files in preLocalSettings.d for this wiki
foreach ( glob("/path/to/config/wikis/$wikiId/preLocalSettings.d/*.php") as $filename) {
	require_once $filename;
}


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
$wgServer = 'https://wiki.example.com';

// https://www.mediawiki.org/wiki/Manual:$wgScriptPath
$wgScriptPath = "/$wikiId";

// https://www.mediawiki.org/wiki/Manual:$wgUploadPath
$wgUploadPath = "$wgScriptPath/img_auth.php";

// https://www.mediawiki.org/wiki/Manual:$wgUploadDirectory
$wgUploadDirectory = "/path/to/uploads/$wikiId";

// https://www.mediawiki.org/wiki/Manual:$wgLogo
$wgLogo = "/wikis/$wikiId/config/logo.png";

// https://www.mediawiki.org/wiki/Manual:$wgFavicon
$wgFavicon = "/wikis/$wikiId/config/favicon.ico";

// https://www.mediawiki.org/wiki/Manual:$wgMetaNamespace
$wgMetaNamespace = str_replace( ' ', '_', $wgSitename );

$wgScriptExtension = ".php";

## The relative URL path to the skins directory
$wgStylePath = "$wgScriptPath/skins";
$wgResourceBasePath = $wgScriptPath;


/**
 *  5) DATABASE SETUP
 *
 *
 **/
$mezaDatabaseServers = [
	'db-master.example.com',
	'db-replica-1.example.com',
	'db-replica-2.example.com'
];

$mezaDatabasePassword = 'password1';
$mezaDatabaseUser = 'theuser';

$mezaWikiDatabases = [
	'mywiki' => 'db_mywiki'
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
		'flags' => $debug ? DBO_DEFAULT | DBO_DEBUG : DBO_DEFAULT,
		'load' => $databaseReadLoadRatio,
	);
	$databaseReadLoadRatio = 10; // every server after the first gets the same loading
}


# MySQL specific settings
$wgDBprefix = "";

# MySQL table options to use during installation or update
$wgDBTableOptions = "ENGINE=InnoDB, DEFAULT CHARSET=binary";

/**
 *  Primary Wiki mywiki with database name db_mywiki
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
$wgSharedDB = 'db_mywiki';
$wgSharedTables = array(
	'user',            // default
	'user_properties', // default
	'interwiki',       // additional
);


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
	'lb1.example.com',
	'lb2.example.com'
];

// memcached settings
$wgMainCacheType = CACHE_MEMCACHED;
// If parser cache set to CACHE_MEMCACHED, templates used to format SMW query
// results in generic footer don't work. This is a limitation of
// Extension:HeaderFooter which may or may not be able to be worked around.
$wgParserCacheType = CACHE_NONE;
$wgMessageCacheType = CACHE_MEMCACHED;
$wgMemCachedServers = [
	'memcached1.example.com:11211',
	'memcached2.example.com:11211'
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
$wgSecretKey = '1234abc';

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
$wgCacheDirectory = "/path/to/cache/$wikiId";


/**
 *  8) EXTENSION SETTINGS
 *
 *  Load separate file that includes all extensions to be loaded
 */

require_once "/path/to/mediawiki/extensions/ExtensionSettings.php";


/**
 * Extension:CirrusSearch
 *
 * CirrusSearch cluster(s) need to be referenced, which is easier to do here rather than in
 * the CirrusSearch config in ExtensionSettings.php
 */
$wgSearchType = 'CirrusSearch';
$wgCirrusSearchClusters['default'] = [
	'es1.example.com',
	'es2.example.com',
	'es3.example.com'
];
$wgCirrusSearchWikimediaExtraPlugin['id_hash_mod_filter'] = true;


/**
 *  9) LOAD POST LOCAL SETTINGS
 *
 *     Items to override standard config
 *
 *
 **/
#    (1) Load all PHP files in postLocalSettings.d for all wikis
foreach ( glob("/path/to/config/postLocalSettings.d/*.php") as $filename) {
	require_once $filename;
}
#    (2) Load all PHP files in postLocalSettings.d for this wiki
foreach ( glob("/path/to/config/wikis/$wikiId/postLocalSettings.d/*.php") as $filename) {
	require_once $filename;
}
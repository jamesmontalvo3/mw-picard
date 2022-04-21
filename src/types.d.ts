type CommonExtensionConfig = {
	name: string;
	version: string;
	skin?: boolean;
	config?: string;
	more_config?: string;
	composer_merge?: boolean;
	git_submodules?: boolean;
	legacy_load?: boolean;
	update_php_on_change?: false | "code-changes" | "all"; // FIXME required?
	wikis?: string[];
};

type StandardExtensionConfig = CommonExtensionConfig & {
	repo: string;
};

type ComposerExtensionConfig = CommonExtensionConfig & {
	composer: string;
};

type ExtensionConfig = StandardExtensionConfig | ComposerExtensionConfig;

type BaselineExtensionConfig = ExtensionConfig & { bundles?: string[] };
type PartialExtensionConfig = Partial<ExtensionConfig> & { name: string };
type ExtensionConfigMap = { [name: string]: ExtensionConfig };

type MWPicardError<E = unknown> = {
	failed: true;
	error: E;
};

// move totypes.d.ts fixme
type AppError = {
	errorType: "AppError";
	msg: string;
};

type MezaAuthType =
	| "none"
	| "anon-read"
	| "anon-edit"
	| "user-edit"
	| "user-read"
	| "viewer-read";

type WikiConfig = {
	id: string;

	/**
	 * Name of your wiki. This will also be used to generate $wgMetaNamespace. See
	 *  - https://www.mediawiki.org/wiki/Manual:$wgSitename
	 *  - https://www.mediawiki.org/wiki/Manual:$wgMetaNamespace
	 */
	sitename: string;

	/**
	 * Allows a wiki to have a different auth type than the default
	 */
	wikiMezaAuthType?: MezaAuthType;

	redirectsFrom?: string[];
	isPrimaryWiki?: boolean;
	dbName: string;
};

type PrimaryWiki = { id: string; dbName: string };

type PlatformConfig = {
	wikis: WikiConfig[];
	appMediawikiPath: string;
	appUploadsDirectory: string;

	extensionsFiles: {
		specifier: string;
		baseline: string;
	};

	controllerComposerCmd: string;
	controllerMediawikiPath: string;

	systemMezaAuthType: MezaAuthType;
	appMoreConfigPath: string; // FIXME is this really the wiki-specific config path?
	allowRequestDebug: boolean;
	wikiAppFqdn: string;
	enableEmail: boolean;
	wgPasswordSender: string;
	wgEmergencyContact: string;
	wgSecretKey: string; // FIXME make this env var
	appCacheDirectory: string;
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

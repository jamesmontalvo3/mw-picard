type CommonExtensionConfig = {
	name: string;
	version: string;
	skin?: boolean;
	config?: string;
	more_config?: string;
	composer_merge?: boolean;
	git_submodules?: boolean;
	legacy_load?: boolean;
	update_php_on_change?: false | "code-changes" | "all";
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

type AppError = {
	errorType: "AppError";
	msg: string;
};

type WikiConfig = {
	id: string;

	/**
	 * Name of your wiki. This will also be used to generate $wgMetaNamespace. See
	 *  - https://www.mediawiki.org/wiki/Manual:$wgSitename
	 *  - https://www.mediawiki.org/wiki/Manual:$wgMetaNamespace
	 */
	sitename: string;

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

	appMoreConfigPath: string;
	wikiAppFqdn: string;
	appCacheDirectory: string;

	dbMaster: string;
	dbReplicas?: string[];

	loadBalancers: string[];
	memcachedServers: string[];
	elasticsearchServers: string[];
};

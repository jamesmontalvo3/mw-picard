type CommonExtensionConfig = {
	name: string;
	version: string;
	skin?: boolean;
	config?: string;
	more_config?: string;
	composer_merge?: boolean;
	git_submodules?: boolean;
	legacy_load?: boolean;
	update_php_on_change?: boolean;
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

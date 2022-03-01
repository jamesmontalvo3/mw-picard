# MW-Picard

Making MediaWiki config so

## Usage for extension maintenance

A "baseline" extension config defines all the extensions that could possibly be installed in your setup. It must fully define the `name`, `version` and either `composer` or `repo` properties. Additional optional properties are also available and discussed later.

```yaml
- name: SemanticExtraSpecialProperties
  composer: "mediawiki/semantic-extra-special-properties"
  update_php_on_change: "all"
  version: "2.0.0"

- name: Echo
  repo: https://github.com/wikimedia/mediawiki-extensions-Echo.git
  version: "d34f32174c23818dbf057a5482dc6ed4781a3a25"
  update_php_on_change: "code-changes"
  config: |
    $wgEchoEmailFooterAddress = $wgPasswordSender;

- name: NumerAlpha
  repo: https://github.com/wikimedia/mediawiki-extensions-NumerAlpha.git
  version: tags/0.7.0
  legacy_load: True

- name: Elastica
  repo: https://github.com/wikimedia/mediawiki-extensions-Elastica.git
  version: "REL1_35"
  update_php_on_change: "code-changes"
  composer_merge: True

- name: VisualEditor
  repo: https://github.com/wikimedia/mediawiki-extensions-VisualEditor.git
  version: "REL1_35"
  update_php_on_change: "code-changes"
  git_submodules: True

- name: Vector
  skin: true
  repo: https://github.com/wikimedia/mediawiki-skins-Vector.git
  version: "REL1_35"
```

A "specified" extension config then can _specify_ which of the baseline to use as well as alter or add to it:

```yaml
- name: SemanticExtraSpecialProperties
- name: VisualEditor
  repo: "https://github.com/yourpersonal/repo1"
  version: master
- name: Elastica
  version: b929bc6e56b51a8356c04b3761c262b6a9a423e3
- name: AnExtensionNotInBaseline
  repo: "https://github.com/yourpersonal/repo2"
  version: tags/1.2.3
- name: Modern
  skin: true
  repo: https://github.com/wikimedia/mediawiki-skins-Modern.git
  version: "REL1_35"
```

### get-ext command

Running the following command should use git to get the non-Composer extensions and skins specified above and put them in `/path/to/mediawiki` in `extensions` and `skins`:

```bash
mw-picard get-ext \
	--baseline=/path/to/baseline.yml
	--specifier=/path/to/config/specifier.yml
	--mediawiki=/path/to/mediawiki
	# if extensions or skins are in non-standard locations, add --extensions and --skins
```

This will create the following directories in `/path/to/mediawiki/extensions`:

```
VisualEditor <-- for this it will run `git submodule update --init` because git_submodules:true
AnExtensionNotInBaseline
```

And the following in `/path/to/mediawiki/skins`:

```
Modern
```

It will also create `/path/to/mediawiki/composer.local.json` as follows:

```json
{
	"require": {
		"mediawiki/semantic-extra-special-properties": "2.0.0"
	},
	"extra": {
		"merge-plugin": {
			"include": ["extensions/Elastica/composer.json"]
		}
	}
}
```

And will run composer install/update to get those extensions.

Next it will generate a `/path/to/config/specifier.installed.yml` file after all other changes are made. If one of these files existed prior to this run, it would have been used to determine which extensions required update. For git-installed extensions this means simply getting new versions for each extension necessary. For Composer-installed extensions the whole `composer.local.json` is re-written and composer install/update commands are run if any composer-installed extension is modified.

Next it will generate `/path/to/mediawiki/extensions/ExtensionSettings.php` to be included in `/path/to/mediawiki/LocalSettings.php`.

Lastly, it will generate `/path/to/config/update-php-required.json` which looks like the following if only certain wikis need `update.php` run:

```json
{ "wikis": ["my-wiki", "your-wiki"] }
```

Or like the following if all wikis need it run:

```json
{ "all": true }
```

If no wikis need `update.php`, no file is created. Whether or not `update.php` is run is determined by whether an extension with `update_php_on_change: true` was changed.

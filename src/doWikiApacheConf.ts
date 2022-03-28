import dedent from "dedent-js";

/*
const doSimpleSamlPhp = () => {
	return dedent`
        # Use SimpleSamlPhp to handle authentication
        Alias /simplesaml {{ m_simplesamlphp_path }}/www
        <Directory {{ m_simplesamlphp_path }}/www>
            Require all granted
            Options All -Indexes
        </Directory>
        `;
};*/

export const doWikiApacheConf = (): string => {
	const www = "/var/www/mediawiki";

	return dedent`
        <VirtualHost *:80>

            <Directory ${www}>
                AllowOverride All
                Options Indexes FollowSymLinks
                Require all granted
                Options All -Indexes
            </Directory>

            DocumentRoot ${www}

            # WAS: ServerName https://<domain name>
            #      This server name causes issues with SAML setups, ref #794
            ServerName MezaMainEntrypoint

            // simple saml php here

            # Enable mod_rewrite engine
            RewriteEngine on
            RewriteBase /

            # This is needed for Links inside MS Office documents to resolve properly
            # when using single sign on.
            # Ref: https://groups.google.com/forum/#!topic/simplesamlphp/LcykPSQj_IQ
            RewriteCond %{HTTP_USER_AGENT} ms-office [NC]
            RewriteRule ^ - [L,R=200]

            # Allow access to root index.php
            RewriteRule ^/index.php(.*) - [L]

            # Allow access to /wikis directory (where all wiki content and and settings are located)
            RewriteRule ^/wikis(?:/|$)(.*)$ - [L]

            # Taken from MediaWiki.org [[Extension:Simple Farm]]
            #
            # Redirect virtual wiki path to physical wiki path. There
            # can be no wiki accessible using this path.
            RewriteRule ^/(?!mediawiki(?:/|$))[^/]+(?:/(.*))?$ ${www}/$1

        </VirtualHost>


        # Don't allow access to images directories. Will allow access via img_auth.php
        # FIXME #805: No images are here anymore anyway. We actually have no method of NOT
        #             using img_auth.php now. Remove me.
        <DirectoryMatch "^${www}/wikis/(.+)/images">
            Order Allow,Deny
            Deny From All
        </DirectoryMatch>
        `;
};

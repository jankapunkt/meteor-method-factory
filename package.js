Package.describe({
	name: 'jkuester:meteor-method-factory',
	version: '0.1.5',
	// Brief, one-line summary of the package.
	summary: 'Factory to create validated methods by given input.',
	// URL to the Git repository containing the source code for this package.
	git: 'https://github.com/jankapunkt/meteor-method-factory.git',
	// By default, Meteor will default to using README.md for documentation.
	// To avoid submitting documentation, set this field to null.
	documentation: 'README.md'
});

Package.onUse(function (api) {
	api.versionsFrom('1.5');
	api.use('ecmascript');
	api.use('random');
	api.use('check');
	api.use('underscore');
	api.use('ddp-rate-limiter');
	api.use('mdg:validated-method@1.1.0');
	api.use('alanning:roles@1.2.16');
	api.use('jkuester:simpl-schema-factory@0.1.0');
	api.mainModule('meteor-method-factory.js');
});

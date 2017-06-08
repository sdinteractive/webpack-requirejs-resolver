'use strict';

const vm = require('vm');

function RequireJsResolverPlugin(options) {
    this.configPath = options.configPath;
}

RequireJsResolverPlugin.prototype.getConfig = function(fs) {
    return new Promise((resolve, reject) => {
        if (this.configData) {
            return resolve(this.configData);
        }

        fs.readFile(this.configPath, function(err, buffer) {
            if (err) {
                reject(err);
            } else {
                resolve(buffer.toString('utf8'));
            }
        });
    }).then(code => {
        if (this.configData) {
            return this.configData;
        }

        var sandbox = {
            window: {location: {href: ''}},
            paths: {},
            require: function() {
            },
        };
        sandbox.require.addPaths = function(paths) {
            for (var path in paths) {
                sandbox.paths[path] = paths[path];
            }
        };
        sandbox.require.config = function(config) {
            if (config.paths) {
                this.addPaths(config.paths);
            }

            // Used by Magento.
            if (config.map && config.map['*']) {
                this.addPaths(config.map['*']);
            }
        };
        vm.runInNewContext(code, sandbox, {
            filename: this.configPath,
            displayErrors: true,
        });

        this.configData = sandbox.paths;
        return this.configData;
    });
};

RequireJsResolverPlugin.prototype.apply = function(resolver) {
    resolver.plugin('module', (request, callback) => {
        this.getConfig(resolver.fileSystem).then(config => {
            if (config[request.request]) {
                var nextRequest = Object.assign({}, request, { request: config[request.request] });
                return resolver.doResolve('resolve', nextRequest, 'mapping via requirejs-config', function(err, result) {
                    callback(err, result);
                });
            } else {
                callback();
            }
        })
    });
};

module.exports = RequireJsResolverPlugin;

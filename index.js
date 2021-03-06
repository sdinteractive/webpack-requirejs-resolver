'use strict';

const vm = require('vm');

function RequireJsResolverPlugin(options) {
    this.configPath = options.configPath;
    this.sandbox = options.sandbox || {};
}

RequireJsResolverPlugin.prototype.getConfig = function (fs) {
    return new Promise((resolve, reject) => {
        if (this.configData) {
            return resolve(this.configData);
        }

        fs.readFile(this.configPath, (err, buffer) => {
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

        let sandbox = Object.assign({
            paths: {},
            require: () => {
            },
        }, this.sandbox);
        sandbox.require.addPaths = function (paths) {
            for (let path in paths) {
                sandbox.paths[path] = paths[path];
            }
        };
        sandbox.require.config = function (config) {
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

function registerHook(object, oldName, newName, cb) {
    if (object.hooks) {
        object.hooks[newName].tapAsync('RequireJsResolverPlugin', cb);
    } else {
        object.plugin(oldName, cb);
    }
}

RequireJsResolverPlugin.prototype.apply = function (resolver) {
    const target = resolver.ensureHook('resolve');
    registerHook(resolver, 'module', 'module', (request, resolveContext, callback) => {
        if (!callback) {
            callback = resolveContext;
        }
        this.getConfig(resolver.fileSystem).then(config => {
            if (config[request.request]) {
                const nextRequest = Object.assign({}, request, { request: config[request.request] });
                return resolver.doResolve(target, nextRequest, 'mapping via requirejs-config', callback);
            } else {
                callback();
            }
        }, err => {
            callback(err);
        });
    });
};

module.exports = RequireJsResolverPlugin;

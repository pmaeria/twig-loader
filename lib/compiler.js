var path = require("path");
var _ = require("underscore");
var loaderUtils = require("loader-utils");

module.exports = function(loaderContext) {
    return function(id, tokens, pathToTwig) {
        var includes = [];
        var options = loaderUtils.getLoaderConfig(loaderContext);
        var alias = options.alias || {};
        var aliasKeys = Object.keys(alias);

        var processDependency = function(token) {

            var paths = token.value.split(path.sep);
            var depPath = token.value;
            includes.push(depPath);

            // create absolute path here
            // if path begins with an alias, join it with alias path
            if (paths[0] && aliasKeys.indexOf(paths[0]) > -1) {
                depPath = path.join(alias[paths[0]], paths.slice(1).join(path.sep));
            }
            else {
                depPath =  path.resolve(path.dirname(id), token.value);
            }
            
            token.value = depPath;
        };

        var processToken = function(token) {
            if (token.type == "logic" && token.token.type) {
                switch(token.token.type) {
                    case 'Twig.logic.type.block':
                    case 'Twig.logic.type.if':
                    case 'Twig.logic.type.elseif':
                    case 'Twig.logic.type.else':
                    case 'Twig.logic.type.for':
                    case 'Twig.logic.type.spaceless':
                    case 'Twig.logic.type.macro':
                        _.each(token.token.output, processToken);
                        break;
                    case 'Twig.logic.type.extends':
                    case 'Twig.logic.type.include':
                        _.each(token.token.stack, processDependency);
                        break;
                    case 'Twig.logic.type.embed':
                        _.each(token.token.output, processToken);
                        _.each(token.token.stack, processDependency);
                        break;
                    case 'Twig.logic.type.import':
                    case 'Twig.logic.type.from':
                        if (token.token.expression != '_self') {
                            _.each(token.token.stack, processDependency);
                        }
                        break;
                }
            }
        };

        var parsedTokens = JSON.parse(tokens);

        _.each(parsedTokens, processToken);

        var output = [
            'var twig = require("' + pathToTwig + '").twig,',
            '    template = twig({id:' + JSON.stringify(id) + ', data:' + JSON.stringify(parsedTokens) + ', allowInlineIncludes: true, rethrow: true});\n',
            'module.exports = function(context) { return template.render(context); }'
        ];

        if (includes.length > 0) {
            _.each(_.uniq(includes), function(file) {
                output.unshift("require("+ JSON.stringify(file) +");\n");
            });
        }

        return output.join('\n');
    };
};
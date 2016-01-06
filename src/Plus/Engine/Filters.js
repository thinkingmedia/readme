/**
 * @param Q
 * @param _
 * @param {Plus.Files.Logger} Logger
 * @param {Plus.Engine.Filter} Filter
 * @param MultiMap
 * @param {Plus.Engine.Section} Section
 * @param {Plus.Collections.Arrays} Arrays
 *
 * @returns {Plus.Engine.Filters}
 */
function Module(Q, _, Logger, Filter, MultiMap, Section, Arrays) {

    /**
     * @name Plus.Engine.Filters
     * @constructor
     */
    var Filters = function () {
        this.items = new MultiMap();
    };

    /**
     * @returns {number}
     */
    Filters.prototype.count = function () {
        return this.items.length;
    };

    /**
     * Validate this collection
     */
    Filters.prototype.beforeRender = function () {
        if (this.count() == 0) {
            throw Error("There are no filters to render.");
        }
    };

    /**
     * @param {string} name
     * @returns {boolean}
     */
    Filters.prototype.contains = function (name) {
        if (!_.isString(name) && name !== '') {
            throw Error('invalid argument');
        }
        return this.items.has(name);
    };

    /**
     * @readme filters."Add Filter"
     *
     * Hook a function to a specific filter action. ReadMe offers filters to allow Writers to modify various types
     * of data at writing time.
     *
     * A writer can modify data by binding a callback to a filter hook. When the filter is later applied, each bound
     * callback is run in order of priority, and given the opportunity to modify a value by returning a new value.
     *
     * @param {string} name
     * @param {function} hook
     * @param {number=} priority
     */
    Filters.prototype.add = function (name, hook, priority) {

        Logger.debug('Filters::add %s %s', name, priority);

        this.items.get(name).add(new Filter(name, hook, priority));
    };

    /**
     * @param {string} name
     * @returns {Plus.Engine.Filter[]}
     */
    Filters.prototype.byPriority = function (name) {
        if (!_.isString(name) && name !== '') {
            throw Error('invalid argument');
        }
        return _.sortByOrder(this.items.get(name) || [], 'priority', ['desc']);
    };

    /**
     * @param {string} name
     * @param {*=} value
     * @returns {promise}
     */
    Filters.prototype.apply = function (name, value) {
        if (!_.isString(name) && name !== '') {
            throw Error('invalid argument');
        }

        Logger.debug('Filters::apply %s', name);

        var promise = Q(value);
        _.each(this.byPriority(name), function (/** Plus.Engine.Filter */filter) {
            promise = promise.then(function (value) {
                return filter.hook(value);
            });
        });
        return promise;
    };

    /**
     * @param {string[]|string} names
     * @returns {Promise[]}
     */
    Filters.prototype.promises = function (names) {

        names = _.isArray(names) ? names : [names];

        return _.map(names, function (name) {
            return this.contains(name)
                ? this.apply(name)
                : Q(undefined);
        }.bind(this));
    };

    /**
     * @param {string|string[]} names
     * @param {Function} callback
     *
     * @returns {Promise}
     */
    Filters.prototype.resolve = function (names, callback) {

        var promises = this.promises(names);

        return Q.all(promises)
            .then(function (values) {
                return callback.apply(this, values);
            }.bind(this));
    };

    /**
     * @param {string|string[]} files
     */
    Filters.prototype.load = function (files) {
        _.each(_.isArray(files) ? files : [files], function (file) {
            var filter = require(file);
            if (filter instanceof Filter) {
                throw Error('Expected module to export a Filter object');
            }
            this.items.get(name).add(filter);
        }.bind(this));
    };

    /**
     * @todo Markdown should be created and attached to sections.
     *
     * @param {Plus.Engine.Section} section
     * @returns {Promise<Plus.Engine.Section>}
     */
    Filters.prototype.render = function (section) {
        if(!section || !(section instanceof Section)) {
            throw Error('invalid argument');
        }

        var self = this;
        return self.apply(section.name, section.markdown).then(function (/**Plus.Files.Markdown*/md) {
            // filter properties
            var title = self.apply(section.name + ":title", md.title);
            var lines = self.apply(section.name + ":lines", md.lines);
            // return a promise that resolves to a section
            return Q.spread([title, lines], function (title, lines) {
                section.markdown = md.clone();
                section.markdown.title = title.trim();
                section.markdown.lines = Arrays.trim(lines);
                return section;
            });
        });
    };

    return Filters;
}

module.exports = [
    'Q',
    'lodash',
    'Plus/Files/Logger',
    'Plus/Engine/Filter',
    'collections/multi-map',
    'Plus/Engine/Section',
    'Plus/Collections/Arrays',
    Module
];
/**
 * Olemop
 * MIT Licensed
 */

const fs = require('fs')
const path = require('path')
const application = require('./application')
const Package = require('../package')
const events = require('./util/events')

/**
 * Expose `createApplication()`.
 */
const Olemop = {
  /**
   * Framework version.
   */
  version: Package.version,

  /**
   * Event definitions that would be emitted by app.event
   */
  events: events,

  /**
   * auto loaded components
   */
  components: {},

  /**
   * auto loaded filters
   */
  filters: {},

  /**
   * auto loaded rpc filters
   */
  rpcFilters: {}
}

Olemop.connectors = {}
Olemop.connectors.__defineGetter__('sioconnector', load.bind(null, './connectors/sioconnector'))
Olemop.connectors.__defineGetter__('hybridconnector', load.bind(null, './connectors/hybridconnector'))
Olemop.connectors.__defineGetter__('udpconnector', load.bind(null, './connectors/udpconnector'))
Olemop.connectors.__defineGetter__('mqttconnector', load.bind(null, './connectors/mqttconnector'))

Olemop.pushSchedulers = {}
Olemop.pushSchedulers.__defineGetter__('direct', load.bind(null, './pushSchedulers/direct'))
Olemop.pushSchedulers.__defineGetter__('buffer', load.bind(null, './pushSchedulers/buffer'))

var self = this

/**
 * Create an olemop application.
 *
 * @return {Application}
 * @memberOf Olemop
 * @api public
 */
Olemop.createApp = function (opts) {
  var app = application
  app.init(opts)
  self.app = app
  return app
}

/**
 * Get application
 */
Object.defineProperty(Olemop, 'app', {
  get: function () {
    return self.app
  }
})

/**
 * Auto-load bundled components with getters.
 */
fs.readdirSync(__dirname + '/components').forEach(function (filename) {
  if (!/\.js$/.test(filename)) {
    return
  }
  var name = path.basename(filename, '.js')
  var _load = load.bind(null, './components/', name)

  Olemop.components.__defineGetter__(name, _load)
  Olemop.__defineGetter__(name, _load)
})

fs.readdirSync(__dirname + '/filters/handler').forEach(function (filename) {
  if (!/\.js$/.test(filename)) {
    return
  }
  var name = path.basename(filename, '.js')
  var _load = load.bind(null, './filters/handler/', name)

  Olemop.filters.__defineGetter__(name, _load)
  Olemop.__defineGetter__(name, _load)
})

fs.readdirSync(__dirname + '/filters/rpc').forEach(function (filename) {
  if (!/\.js$/.test(filename)) {
    return
  }
  var name = path.basename(filename, '.js')
  var _load = load.bind(null, './filters/rpc/', name)

  Olemop.rpcFilters.__defineGetter__(name, _load)
})

function load(path, name) {
  if (name) {
    return require(path + name)
  }
  return require(path)
}

module.exports = Olemop

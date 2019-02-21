/**
 * Olemop
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
  events,

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

Olemop.connectors = {
  get sioconnector() { return load('./connectors/sioconnector') },
  get hybridconnector() { return load('./connectors/hybridconnector') },
  get udpconnector() { return load('./connectors/udpconnector') },
  get mqttconnector() { return load('./connectors/mqttconnector') }
}

Olemop.pushSchedulers = {
  get direct() { return load('./pushSchedulers/direct') },
  get buffer() { return load('./pushSchedulers/buffer') }
}

const self = this

/**
 * Create an olemop application.
 *
 * @returns {Application}
 */
Olemop.createApp = function (opts) {
  application.init(opts)
  self.app = application
  return application
}

/**
 * Get application
 */
Object.defineProperty(Olemop, 'app', {
  get () {
    return self.app
  }
})

/**
 * Auto-load bundled components with getters.
 */
fs.readdirSync(__dirname + '/components').forEach((filename) => {
  if (!/\.js$/.test(filename)) return
  const name = path.basename(filename, '.js')
  const _load = load.bind(null, './components/', name)

  Object.defineProperty(Olemop.components, name, {
    get: _load
  })
  Object.defineProperty(Olemop, name, {
    get: _load
  })
})

fs.readdirSync(__dirname + '/filters/handler').forEach((filename) => {
  if (!/\.js$/.test(filename)) return
  const name = path.basename(filename, '.js')
  const _load = load.bind(null, './filters/handler/', name)

  Object.defineProperty(Olemop.filters, name, {
    get: _load
  })
  Object.defineProperty(Olemop, name, {
    get: _load
  })
})

fs.readdirSync(__dirname + '/filters/rpc').forEach((filename) => {
  if (!/\.js$/.test(filename)) return
  const name = path.basename(filename, '.js')
  const _load = load.bind(null, './filters/rpc/', name)

  Object.defineProperty(Olemop.rpcFilters, name, {
    get: _load
  })
})

function load (path, name) {
  if (name) {
    return require(path + name)
  }
  return require(path)
}

module.exports = Olemop

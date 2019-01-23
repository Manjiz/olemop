const Loader = require('@olemop/loader')
const Gateway = require('./gateway')
// const WSAcceptor = require('./acceptors/ws-acceptor')
// const TcpAcceptor = require('./acceptors/tcp-acceptor')
const MqttAcceptor = require('./acceptors/mqtt-acceptor')

const loadRemoteServices = (paths, context) => {
  const res = {}
  paths.forEach((item) => {
    const m = Loader.load(item.path, context)
    if (m) {
      createNamespace(item.namespace, res)
      Object.keys(m).forEach((key) => {
        res[item.namespace][key] = m[key]
      })
    }
  })

  return res
}

const createNamespace = (namespace, proxies) => {
  proxies[namespace] = proxies[namespace] || {}
}

/**
 * Create rpc server.
 *
 * @param  {Object}      opts construct parameters
 *                       opts.port {Number|String} rpc server listen port
 *                       opts.paths {Array} remote service code paths, [{namespace, path}, ...]
 *                       opts.context {Object} context for remote service
 *                       opts.acceptorFactory {Object} (optionals)acceptorFactory.create(opts, cb)
 * @return {Object}      rpc server instance
 */
const create = (opts) => {
  if (!opts || !opts.port || opts.port < 0 || !opts.paths) {
    throw new Error('opts.port or opts.paths invalid.')
  }
  opts.services = loadRemoteServices(opts.paths, opts.context)
  const gateway = Gateway.create(opts)
  return gateway
}

module.exports = {
  create,
  MqttAcceptor
}

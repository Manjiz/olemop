const async = require('async')
const Loader = require('@olemop/loader')
const logger = require('@olemop/logger').getLogger('olemop-rpc', 'rpc-client')
const failureProcess = require('./failureProcess')
const constants = require('../util/constants')
const Station = require('./mailstation')
const Tracer = require('../util/tracer')
const Proxy = require('../util/proxy')
const router = require('./router')
// socket.io
// const WSMailbox = require('./mailboxes/ws-mailbox')
// ws
// const WS2Mailbox = require('./mailboxes/ws2-mailbox')
// mqtt
const MQTTMailbox = require('./mailboxes/mqtt-mailbox')

/**
 * Client states
 */
// client has inited
const STATE_INITED = 1
// client has started
const STATE_STARTED = 2
// client has closed
const STATE_CLOSED = 3

/**
 * Create mail station.
 *
 * @param opts {Object} construct parameters.
 */
const createStation = (opts) => Station.create(opts)

/**
 * Add proxy into array.
 *
 * @param proxies {Object} rpc proxies
 * @param namespace {string} rpc namespace sys/user
 * @param serverType {string} rpc remote server type
 * @param proxy {Object} rpc proxy
 */
const insertProxy = (proxies, namespace, serverType, proxy) => {
  proxies[namespace] = proxies[namespace] || {}
  if (proxies[namespace][serverType]) {
    for (let attr in proxy) {
      proxies[namespace][serverType][attr] = proxy[attr]
    }
  } else {
    proxies[namespace][serverType] = proxy
  }
}

/**
 * Rpc to specified server id or servers.
 *
 * @param client     {Object} current client instance.
 * @param msg        {Object} rpc message.
 * @param serverType {string} remote server type.
 * @param serverId   {Object} mailbox init context parameter.
 */
const rpcToSpecifiedServer = (client, msg, serverType, serverId, cb) => {
  if (typeof serverId !== 'string') {
    logger.error(`[olemop-rpc] serverId is not a string : ${serverId}`)
    return
  }
  if (serverId === '*') {
    const servers = client._routeContext.getServersByType(serverType)
    if (!servers) {
      logger.error(`[olemop-rpc] serverType ${serverType} servers not exist`)
      return
    }

    async.each(servers, (server, next) => {
      client.rpcInvoke(server.id, msg, (err) => {
        next(err)
      })
    }, cb)
  } else {
    client.rpcInvoke(serverId, msg, cb)
  }
}

/**
 * Calculate remote target server id for rpc client.
 *
 * @param client {Object} current client instance.
 * @param serverType {string} remote server type.
 * @param routeParam {Object} mailbox init context parameter.
 * @param cb {Function} return rpc remote target server id.
 */
const getRouteTarget = (client, serverType, msg, routeParam, cb) => {
  if (client.routerType) {
    let method
    switch (client.routerType) {
      case constants.SCHEDULE.ROUNDROBIN:
        method = router.rr
        break
      case constants.SCHEDULE.WEIGHT_ROUNDROBIN:
        method = router.wrr
        break
      case constants.SCHEDULE.LEAST_ACTIVE:
        method = router.la
        break
      case constants.SCHEDULE.CONSISTENT_HASH:
        method = router.ch
        break
      default:
        method = router.rd
    }
    method.call(null, client, serverType, msg, (err, serverId) => {
      cb(err, serverId)
    })
  } else {
    let route
    let target
    if (typeof client.router === 'function') {
      route = client.router
      target = null
    } else if (typeof client.router.route === 'function') {
      route = client.router.route
      target = client.router
    } else {
      logger.error('[olemop-rpc] invalid route function.')
      return
    }
    route.call(target, routeParam, msg, client._routeContext, (err, serverId) => {
      cb(err, serverId)
    })
  }
}

/**
 * Generate prxoy for function type field
 *
 * @param client {Object} current client instance.
 * @param serviceName {string} delegated service name.
 * @param methodName {string} delegated method name.
 * @param args {Object} rpc invoke arguments.
 * @param attach {Object} attach parameter pass to proxyCB.
 * @param isToSpecifiedServer {boolean} true means rpc route to specified remote server.
 */
const proxyCB = (client, serviceName, methodName, args, attach, isToSpecifiedServer) => {
  if (client.state !== STATE_STARTED) {
    logger.error('[olemop-rpc] fail to invoke rpc proxy for client is not running')
    return
  }
  if (args.length < 2) {
    logger.error('[olemop-rpc] invalid rpc invoke, arguments length less than 2, namespace: %j, serverType, %j, serviceName: %j, methodName: %j', attach.namespace, attach.serverType, serviceName, methodName)
    return
  }
  const routeParam = args.shift()
  const cb = args.pop()
  const serverType = attach.serverType
  const msg = {
    namespace: attach.namespace,
    serverType,
    service: serviceName,
    method: methodName,
    args
  }

  if (isToSpecifiedServer) {
    rpcToSpecifiedServer(client, msg, serverType, routeParam, cb)
  } else {
    getRouteTarget(client, serverType, msg, routeParam, (err, serverId) => {
      if (err) {
        return cb(err)
      }

      client.rpcInvoke(serverId, msg, cb)
    })
  }
}

/**
 * Generate proxies for remote servers.
 *
 * @param client {Object} current client instance.
 * @param record {Object} proxy reocrd info. {namespace, serverType, path}
 * @param context {Object} mailbox init context parameter
 */
const generateProxy = (client, record, context) => {
  if (!record) return

  const modules = Loader.load(record.path, context)

  if (!modules) return

  const res = {}
  for (let name in modules) {
    res[name] = Proxy.create({
      service: name,
      origin: modules[name],
      attach: record,
      proxyCB: proxyCB.bind(null, client)
    })
  }
  return res
}

/**
 * RPC Client Class
 */
const Client = function (opts = {}) {
  this._context = opts.context
  this._routeContext = opts.routeContext
  this.router = opts.router || router.df
  this.routerType = opts.routerType
  this.rpcDebugLog = opts.rpcDebugLog
  if (this._context) {
    opts.clientId = this._context.serverId
  }
  this.opts = opts
  this.proxies = {}
  this._station = createStation(opts)
  this.state = STATE_INITED
}

/**
 * Start the rpc client which would try to connect the remote servers and
 * report the result by cb.
 *
 * @param cb {Function} cb(err)
 */
Client.prototype.start = function (cb) {
  if (this.state > STATE_INITED) {
    cb(new Error('rpc client has started.'))
    return
  }

  this._station.start((err) => {
    if (err) {
      logger.error(`[olemop-rpc] client start fail for ${err.stack}`)
      return cb(err)
    }
    this._station.on('error', failureProcess.bind(this._station))
    this.state = STATE_STARTED
    cb()
  })
}

/**
 * Stop the rpc client.
 *
 * @param  {Boolean} force
 * @returns {Void}
 */
Client.prototype.stop = function (force) {
  if (this.state !== STATE_STARTED) {
    logger.warn('[olemop-rpc] client is not running now.')
    return
  }
  this.state = STATE_CLOSED
  this._station.stop(force)
}

/**
 * Add a new proxy to the rpc client which would overrid the proxy under the
 * same key.
 *
 * @param {Object} record proxy description record, format:
 *                        {namespace, serverType, path}
 */
Client.prototype.addProxy = function (record) {
  if (!record) return

  const proxy = generateProxy(this, record, this._context)

  if (!proxy) return

  insertProxy(this.proxies, record.namespace, record.serverType, proxy)
}

/**
 * Batch version for addProxy.
 * @param {Array} records list of proxy description record
 */
Client.prototype.addProxies = function (records) {
  if (!records || !records.length) return

  records.forEach((item) => {
    this.addProxy(item)
  })
}

/**
 * Add new remote server to the rpc client.
 *
 * @param {Object} server new server information
 */
Client.prototype.addServer = function (server) {
  this._station.addServer(server)
}

/**
 * Batch version for add new remote server.
 *
 * @param {Array} servers server info list
 */
Client.prototype.addServers = function (servers) {
  this._station.addServers(servers)
}

/**
 * Remove remote server from the rpc client.
 *
 * @param  {String|Number} id server id
 */
Client.prototype.removeServer = function (id) {
  this._station.removeServer(id)
}

/**
 * Batch version for remove remote server.
 *
 * @param  {Array} ids remote server id list
 */
Client.prototype.removeServers = function (ids) {
  this._station.removeServers(ids)
}

/**
 * Replace remote servers.
 *
 * @param {Array} servers server info list
 */
Client.prototype.replaceServers = function (servers) {
  this._station.replaceServers(servers)
}

/**
 * Do the rpc invoke directly.
 *
 * @param serverId {string} remote server id
 * @param msg {Object} rpc message. Message format:
 *    {serverType: serverType, service: serviceName, method: methodName, args: arguments}
 * @param cb {Function} cb(err, ...)
 */
Client.prototype.rpcInvoke = function (serverId, msg, cb) {
  let tracer = null

  if (this.rpcDebugLog) {
    tracer = new Tracer(this.opts.rpcLogger, this.opts.rpcDebugLog, this.opts.clientId, serverId, msg)
    tracer.info('client', __filename, 'rpcInvoke', 'the entrance of rpc invoke')
  }

  if (this.state !== STATE_STARTED) {
    tracer && tracer.error('client', __filename, 'rpcInvoke', 'fail to do rpc invoke for client is not running')
    logger.error('[olemop-rpc] fail to do rpc invoke for client is not running')
    cb(new Error('[olemop-rpc] fail to do rpc invoke for client is not running'))
    return
  }
  this._station.dispatch(tracer, serverId, msg, this.opts, cb)
}

/**
 * Add rpc before filter.
 *
 * @param filter {Function} rpc before filter function.
 *
 * @api public
 */
Client.prototype.before = function (filter) {
  this._station.before(filter)
}

/**
 * Add rpc after filter.
 *
 * @param filter {Function} rpc after filter function.
 *
 * @api public
 */
Client.prototype.after = function (filter) {
  this._station.after(filter)
}

/**
 * Add rpc filter.
 *
 * @param filter {Function} rpc filter function.
 *
 * @api public
 */
Client.prototype.filter = function (filter) {
  this._station.filter(filter)
}

/**
 * Set rpc filter error handler.
 *
 * @param handler {Function} rpc filter error handler function.
 *
 * @api public
 */
Client.prototype.setErrorHandler = function (handler) {
  this._station.handleError = handler
}

module.exports = {
  /**
   * RPC client factory method.
   *
   * @param  {Object}      opts client init parameter.
   *                       opts.context: mail box init parameter,
   *                       opts.router: (optional) rpc message route function, route(routeParam, msg, cb),
   *                       opts.mailBoxFactory: (optional) mail box factory instance.
   * @returns {Object}      client instance.
   */
  create (opts) {
    return new Client(opts)
  },

  // WSMailbox,
  // WS2Mailbox,

  MQTTMailbox
}

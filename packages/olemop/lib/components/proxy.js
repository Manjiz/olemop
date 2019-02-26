/**
 * Component for proxy.
 * Generate proxies for rpc client.
 */

const { crc32 } = require('crc')
const Client = require('@olemop/rpc').client
const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const events = require('../util/events')
const pathUtil = require('../util/pathUtil')
const Constants = require('../util/constants')

/**
 * Generate rpc client
 *
 * @param {Object} app current application context
 * @param {Object} opts contructor parameters for rpc client
 * @returns {Object} rpc client
 */
const _genRpcClient = (app, opts) => {
  opts.context = app
  opts.routeContext = app
  return opts.rpcClient ? opts.rpcClient.create(opts) : Client.create(opts)
}

/**
 * Generate proxy for the server infos.
 *
 * @param  {Object} client rpc client instance
 * @param  {Object} app    application context
 * @param  {Array} sinfos server info list
 */
const _genProxies = (client, app, sinfos) => {
  for (let i = 0; i < sinfos.length; i++) {
    const item = sinfos[i]

    if (hasProxy(client, item)) continue

    client.addProxies(_getProxyRecords(app, item))
  }
}

/**
 * Check a server whether has generated proxy before
 *
 * @param  {Object}  client rpc client instance
 * @param  {Object}  sinfo  server info
 * @returns {boolean}        true or false
 */
const hasProxy = (client, sinfo) => {
  const proxy = client.proxies
  return proxy.sys &&  proxy.sys[sinfo.serverType]
}

/**
 * Get proxy path for rpc client.
 * Iterate all the remote service path and create remote path record.
 *
 * @param {Object} app current application context
 * @param {Object} sinfo server info, format: {id, serverType, host, port}
 * @returns {Array}     remote path record array
 */
const _getProxyRecords = (app, sinfo) => {
  const records = []
  // sys remote service path record
  let record = app.isFrontend(sinfo) ? pathUtil.getSysRemotePath('frontend') : pathUtil.getSysRemotePath('backend')
  if (record) {
    records.push(pathUtil.remotePathRecord('sys', sinfo.serverType, record))
  }

  // user remote service path record
  record = pathUtil.getUserRemotePath(app.getBase(), sinfo.serverType)
  if (record) {
    records.push(pathUtil.remotePathRecord('user', sinfo.serverType, record))
  }

  return records
}

const genRouteFun = () => {
  return (session, msg, app, cb) => {
    const routes = app.get('__routes__')

    if (!routes) {
      defaultRoute(session, msg, app, cb)
      return
    }

    const route = routes[msg.serverType] || routes['default']

    if (route) {
      route(session, msg, app, cb)
    } else {
      defaultRoute(session, msg, app, cb)
    }
  }
}

const defaultRoute = (session, msg, app, cb) => {
  const list = app.getServersByType(msg.serverType)
  if (!list || !list.length) {
    cb(new Error(`can not find server info for type: ${msg.serverType}`))
    return
  }

  const uid = (session && session.uid) || ''
  const index = Math.abs(crc32(uid.toString())) % list.length
  olemopUtils.invokeCallback(cb, null, list[index].id)
}

/**
 * Proxy component class
 *
 * @param {Object} app  current application context
 * @param {Object} opts construct parameters
 */
class ProxyComponent {
  constructor(app, opts) {
    this.name = '__proxy__'
    this.app = app
    this.opts = opts
    this.client = _genRpcClient(this.app, opts)
    this.app.event.on(events.ADD_SERVERS, this.addServers.bind(this))
    this.app.event.on(events.REMOVE_SERVERS, this.removeServers.bind(this))
    this.app.event.on(events.REPLACE_SERVERS, this.replaceServers.bind(this))
  }

  /**
   * Proxy component lifecycle function
   *
   * @param {Function} cb
   */
  start (cb) {
    if (this.opts.enableRpcLog) {
      logger.warn('enableRpcLog is deprecated in 0.8.0, please use app.rpcFilter(olemop.rpcFilters.rpcLog())')
    }
    const rpcBefores = this.app.get(Constants.KEYWORDS.RPC_BEFORE_FILTER)
    const rpcAfters = this.app.get(Constants.KEYWORDS.RPC_AFTER_FILTER)
    const rpcErrorHandler = this.app.get(Constants.RESERVED.RPC_ERROR_HANDLER)

    if (rpcBefores) {
      this.client.before(rpcBefores)
    }
    if (rpcAfters) {
      this.client.after(rpcAfters)
    }
    if (rpcErrorHandler) {
      this.client.setErrorHandler(rpcErrorHandler)
    }
    process.nextTick(cb)
  }

  /**
   * Component lifecycle callback
   *
   * @param {Function} cb
   */
  afterStart (cb) {
    Object.defineProperty(this.app, 'rpc', {
      get: () => {
        return this.client.proxies.user
      }
    })
    Object.defineProperty(this.app, 'sysrpc', {
      get: () => {
        return this.client.proxies.sys
      }
    })
    this.app.set('rpcInvoke', this.client.rpcInvoke.bind(this.client), true)
    this.client.start(cb)
  }

  /**
   * Add remote server to the rpc client.
   *
   * @param {Array} servers server info list, {id, serverType, host, port}
   */
  addServers (servers) {
    if (!servers || !servers.length) return

    _genProxies(this.client, this.app, servers)
    this.client.addServers(servers)
  }

  /**
   * Remove remote server from the rpc client.
   *
   * @param  {Array} ids server id list
   */
  removeServers (ids) {
    this.client.removeServers(ids)
  }

  /**
   * Replace remote servers from the rpc client.
   *
   * @param  {Array} ids server id list
   */
  replaceServers (servers) {
    if (!servers || !servers.length) return

    // update proxies
    this.client.proxies = {}
    _genProxies(this.client, this.app, servers)

    this.client.replaceServers(servers)
  }

  /**
   * Proxy for rpc client rpcInvoke.
   *
   * @param {string}   serverId remote server id
   * @param {Object}   msg      rpc message: {serverType: serverType, service: serviceName, method: methodName, args: arguments}
   * @param {Function} cb      callback function
   */
  rpcInvoke (serverId, msg, cb) {
    this.client.rpcInvoke(serverId, msg, cb)
  }
}

/**
 * Component factory function
 *
 * @param {Object} app  current application context
 * @param {Object} opts construct parameters
 *                      opts.router: (optional) rpc message route function, route(routeParam, msg, cb),
 *                      opts.mailBoxFactory: (optional) mail box factory instance.
 * @returns {Object}     component instance
 */
module.exports = (app, opts = {}) => {
  // proxy default config
  // cacheMsg is deprecated, just for compatibility here.
  opts.bufferMsg = opts.bufferMsg || opts.cacheMsg || false
  opts.interval = opts.interval || 30
  opts.router = genRouteFun()
  opts.context = app
  opts.routeContext = app
  if (app.enabled('rpcDebugLog')) {
    opts.rpcDebugLog = true
    opts.rpcLogger = require('@olemop/logger').getLogger('rpc-debug', __filename)
  }

  return new ProxyComponent(app, opts)
}

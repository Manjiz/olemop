const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const Constants = require('../util/constants')
const MasterWatchdog = require('../master/watchdog')

module.exports = function (opts, consoleService) {
  return new Module(opts, consoleService)
}

module.exports.moduleId = Constants.KEYWORDS.MASTER_WATCHER

const Module = function (opts, consoleService) {
  this.app = opts.app
  this.service = consoleService
  this.id = this.app.getServerId()

  this.watchdog = new MasterWatchdog(this.app, this.service)
  this.service.on('register', onServerAdd.bind(null, this))
  this.service.on('disconnect', onServerLeave.bind(null, this))
  this.service.on('reconnect', onServerReconnect.bind(null, this))
}

// ----------------- bind methods -------------------------

const onServerAdd = (module, record) => {
  logger.debug('masterwatcher receive add server event, with server: %j', record)
  if (!record || record.type === 'client' || !record.serverType) return
  module.watchdog.addServer(record)
}

const onServerReconnect = (module, record) => {
  logger.debug('masterwatcher receive reconnect server event, with server: %j', record)
  if (!record || record.type === 'client' || !record.serverType) {
    logger.warn('onServerReconnect receive wrong message: %j', record)
    return
  }
  module.watchdog.reconnectServer(record)
}

const onServerLeave = (module, id, type) => {
  logger.debug('masterwatcher receive remove server event, with server: %s, type: %s', id, type)
  if (!id) {
    logger.warn('onServerLeave receive server id is empty.')
    return
  }
  if (type !== 'client') {
    module.watchdog.removeServer(id)
  }
}

// ----------------- module methods -------------------------

Module.prototype.start = function (cb) {
  olemopUtils.invokeCallback(cb)
}

Module.prototype.masterHandler = function (agent, msg, cb) {
  if (!msg) {
    logger.warn('masterwatcher receive empty message.')
    return
  }
  const func = masterMethods[msg.action]
  if (!func) {
    logger.info('masterwatcher unknown action: %j', msg.action)
    return
  }
  func(this, agent, msg, cb)
}

// ----------------- monitor request methods -------------------------

const subscribe = (module, agent, msg, cb) => {
  if (!msg) {
    olemopUtils.invokeCallback(cb, new Error('masterwatcher subscribe empty message.'))
    return
  }
  module.watchdog.subscribe(msg.id)
  olemopUtils.invokeCallback(cb, null, module.watchdog.query())
}

const unsubscribe = (module, agent, msg, cb) => {
  if (!msg) {
    olemopUtils.invokeCallback(cb, new Error('masterwatcher unsubscribe empty message.'))
    return
  }
  module.watchdog.unsubscribe(msg.id)
  olemopUtils.invokeCallback(cb)
}

const query = (module, agent, msg, cb) => {
  olemopUtils.invokeCallback(cb, null, module.watchdog.query())
}

const record = (module, agent, msg) => {
  if (!msg) {
    olemopUtils.invokeCallback(cb, new Error('masterwatcher record empty message.'))
    return
  }
  module.watchdog.record(msg.id)
}

const masterMethods = {
  subscribe,
  unsubscribe,
  query,
  record
}

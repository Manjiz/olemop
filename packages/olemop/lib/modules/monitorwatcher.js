const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const events = require('../util/events')
const Constants = require('../util/constants')

module.exports = function (opts, consoleService) {
  return new Module(opts, consoleService)
}

module.exports.moduleId = Constants.KEYWORDS.MONITOR_WATCHER

const Module = function (opts, consoleService) {
  this.app = opts.app
  this.service = consoleService
  this.id = this.app.getServerId()

  this.app.event.on(events.START_SERVER, finishStart.bind(null, this))
}

Module.prototype.start = function (cb) {
  subscribeRequest(this, this.service.agent, this.id, cb)
}

Module.prototype.monitorHandler = function (agent, msg, cb) {
  if (!msg || !msg.action) return
  const func = monitorMethods[msg.action]
  if (!func) {
    logger.info('monitorwatcher unknown action: %j', msg.action)
    return
  }
  func(this, agent, msg, cb)
}

// ----------------- monitor start method -------------------------

const subscribeRequest = (self, agent, id, cb) => {
  const msg = { action: 'subscribe', id }
  agent.request(Constants.KEYWORDS.MASTER_WATCHER, msg, (err, servers) => {
    if (err) {
      logger.error('subscribeRequest request to master with error: %j', err.stack)
      olemopUtils.invokeCallback(cb, err)
    }
    const res = []
    for (let id in servers) {
      res.push(servers[id])
    }
    addServers(self, res)
    olemopUtils.invokeCallback(cb)
  })
}

// ----------------- monitor request methods -------------------------

const addServer = (self, agent, msg, cb) => {
  logger.debug('[%s] receive addServer signal: %j', self.app.serverId, msg)
  if (!msg || !msg.server) {
    logger.warn('monitorwatcher addServer receive empty message: %j', msg)
    olemopUtils.invokeCallback(cb, Constants.SIGNAL.FAIL)
    return
  }
  addServers(self, [msg.server])
  olemopUtils.invokeCallback(cb, Constants.SIGNAL.OK)
}

const removeServer = (self, agent, msg, cb) => {
  logger.debug('%s receive removeServer signal: %j', self.app.serverId, msg)
  if (!msg || !msg.id) {
    logger.warn('monitorwatcher removeServer receive empty message: %j', msg)
    olemopUtils.invokeCallback(cb, Constants.SIGNAL.FAIL)
    return
  }
  removeServers(self, [msg.id])
  olemopUtils.invokeCallback(cb, Constants.SIGNAL.OK)
}

const replaceServer = (self, agent, msg, cb) => {
  logger.debug('%s receive replaceServer signal: %j', self.app.serverId, msg)
  if (!msg || !msg.servers) {
    logger.warn('monitorwatcher replaceServer receive empty message: %j', msg)
    olemopUtils.invokeCallback(cb, Constants.SIGNAL.FAIL)
    return
  }
  replaceServers(self, msg.servers)
  olemopUtils.invokeCallback(cb, Constants.SIGNAL.OK)
}

const startOver = (self, agent, msg, cb) => {
  const func = self.app.lifecycleCbs[Constants.LIFECYCLE.AFTER_STARTALL]
  if (func) {
    func.call(null, self.app)
  }
  self.app.event.emit(events.START_ALL)
  olemopUtils.invokeCallback(cb, Constants.SIGNAL.OK)
}

// ----------------- common methods -------------------------

const addServers = (self, servers) => {
  if (!servers || !servers.length) return
  self.app.addServers(servers)
}

const removeServers = (self, ids) => {
  if (!ids || !ids.length) return
  self.app.removeServers(ids)
}

const replaceServers = (self, servers) => {
  self.app.replaceServers(servers)
}

// ----------------- bind methods -------------------------

const finishStart = (self, id) => {
  const msg = { action: 'record', id }
  self.service.agent.notify(Constants.KEYWORDS.MASTER_WATCHER, msg)
}

const monitorMethods = {
  addServer,
  removeServer,
  replaceServer,
  startOver
}

const EventEmitter = require('events')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const Constants = require('../util/constants')
const countDownLatch = require('../util/countDownLatch')

class Watchdog extends EventEmitter {
  constructor(app, service) {
    super()
    this.app = app
    this.service = service
    this.isStarted = false
    this.count = olemopUtils.size(app.getServersFromConfig())

    this.servers = {}
    this.listeners = {}
  }

  addServer(server) {
    if (!server) return
    this.servers[server.id] = server
    this.notify({ action: 'addServer', server })
  }

  removeServer(id) {
    if (!id) return
    this.unsubscribe(id)
    delete this.servers[id]
    this.notify({ action: 'removeServer', id })
  }

  reconnectServer(server) {
    if (!server) return
    if (!this.servers[server.id]) {
      this.servers[server.id] = server
    }
    // replace server in reconnect server
    this.notifyById(server.id, { action: 'replaceServer', servers: this.servers })
    // notify other server to add server
    this.notify({ action: 'addServer', server })
    // add server in listener
    this.subscribe(server.id)
  }

  subscribe(id) {
    this.listeners[id] = 1
  }

  unsubscribe(id) {
    delete this.listeners[id]
  }

  query() {
    return this.servers
  }

  record(id) {
    if (!this.isStarted && --this.count < 0) {
      const usedTime = Date.now() - this.app.startTime
      logger.info(`all servers startup in ${usedTime} ms`)
      this.notify({ action: 'startOver' })
      this.isStarted = true
    }
  }

  notifyById(id, msg) {
    this.service.agent.request(id, Constants.KEYWORDS.MONITOR_WATCHER, msg, (signal) => {
      if (signal !== Constants.SIGNAL.OK) {
        logger.error('master watchdog fail to notify to monitor, id: %s, msg: %j', id, msg)
      } else {
        logger.debug('master watchdog notify to monitor success, id: %s, msg: %j', id, msg)
      }
    })
  }

  notify(msg) {
    let success = true
    const fails = []
    const timeouts = []
    const requests = {}
    const count = olemopUtils.size(this.listeners)
    if (count === 0) {
      logger.warn('master watchdog listeners is none, msg: %j', msg)
      return
    }
    const latch = countDownLatch.createCountDownLatch(count, {timeout: Constants.TIME.TIME_WAIT_COUNTDOWN}, (isTimeout) => {
      if (isTimeout) {
        for (let key in requests) {
          if (!requests[key])  {
            timeouts.push(key)
          }
        }
        logger.error('master watchdog request timeout message: %j, timeouts: %j, fails: %j', msg, timeouts, fails)
      }
      if (!success) {
        logger.error('master watchdog request fail message: %j, fails: %j', msg, fails)
      }
    })

    for (let id in this.listeners) {
      requests[id] = 0
      // moduleRequest
      this.service.agent.request(id, Constants.KEYWORDS.MONITOR_WATCHER, msg, (signal) => {
        if (signal !== Constants.SIGNAL.OK) {
          fails.push(id)
          success = false
        }
        requests[id] = 1
        latch.done()
      })
    }
  }
}

module.exports = Watchdog

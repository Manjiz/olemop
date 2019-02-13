/**
 * Component for monitor.
 * Load and start monitor client.
 */

const logger = require('@olemop/logger').getLogger('olemop', __filename)
const admin = require('@olemop/admin')
const utils = require('../util/utils')
const moduleUtil = require('../util/moduleUtil')
const Constants = require('../util/constants')

class Monitor {
  constructor(app, opts = {}) {
    this.app = app
    this.serverInfo = app.getCurServer()
    this.masterInfo = app.getMaster()
    this.modules = []
    this.closeWatcher = opts.closeWatcher

    this.monitorConsole = admin.createMonitorConsole({
      id: this.serverInfo.id,
      type: this.app.getServerType(),
      host: this.masterInfo.host,
      port: this.masterInfo.port,
      info: this.serverInfo,
      env: this.app.get(Constants.RESERVED.ENV),
      // auth server function
      authServer: app.get('adminAuthServerMonitor')
    })
  }

  start(cb) {
    moduleUtil.registerDefaultModules(false, this.app, this.closeWatcher)
    this.startConsole(cb)
  }

  startConsole(cb) {
    moduleUtil.loadModules(this, this.monitorConsole)

    this.monitorConsole.start((err) => {
      if (err) {
        utils.invokeCallback(cb, err)
        return
      }
      moduleUtil.startModules(this.modules, (err) => {
        utils.invokeCallback(cb, err)
      })
    })

    this.monitorConsole.on('error', (err) => {
      if (err) {
        logger.error('monitorConsole encounters with error: %j', err.stack)
      }
    })
  }

  stop(cb) {
    this.monitorConsole.stop()
    this.modules = []
    process.nextTick(() => {
      utils.invokeCallback(cb)
    })
  }

  // monitor reconnect to master
  reconnect(masterInfo) {
    this.stop(() => {
      this.monitorConsole = admin.createMonitorConsole({
        id: this.serverInfo.id,
        type: this.app.getServerType(),
        host: masterInfo.host,
        port: masterInfo.port,
        info: this.serverInfo,
        env: this.app.get(Constants.RESERVED.ENV)
      })
      this.startConsole(() => {
        logger.info('restart modules for server : %j finish.', self.app.serverId)
      })
    })
  }
}

module.exports = Monitor

const os = require('os')
const admin = require('@olemop/admin')
const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const starter = require('../master/starter')
const Constants = require('./constants')
const pathUtil = require('./pathUtil')

const startModule = (err, modules, index, cb) => {
  if (err || index >= modules.length) {
    olemopUtils.invokeCallback(cb, err)
    return
  }
  const module = modules[index]
  if (module && typeof module.start === 'function') {
    module.start((err) => {
      startModule(err, modules, ++index, cb)
    })
  } else {
    startModule(err, modules, ++index, cb)
  }
}

module.exports = {
  /**
   * Load admin modules
   */
  loadModules (self, consoleService) {
    // load app register modules
    const _modules = self.app.get(Constants.KEYWORDS.MODULE)

    if (!_modules) return

    const modules = Object.values(_modules).map((m) => m)

    for (let i = 0; i < modules.length; i++) {
      const record = modules[i]
      const module = typeof record.module === 'function' ? record.module(record.opts, consoleService) : record.module
      const moduleId = record.moduleId || module.moduleId

      if (!moduleId) {
        logger.warn('ignore an unknown module.')
        continue
      }

      consoleService.register(moduleId, module)
      self.modules.push(module)
    }
  },

  startModules (modules, cb) {
    // invoke the start lifecycle method of modules
    if (!modules) return
    startModule(null, modules, 0, cb)
  },

  /**
   * Append the default system admin modules
   */
  registerDefaultModules (isMaster, app, closeWatcher) {
    if (!closeWatcher) {
      if (isMaster) {
        app.registerAdmin(require('../modules/masterwatcher'), { app })
      } else {
        app.registerAdmin(require('../modules/monitorwatcher'), { app })
      }
    }
    app.registerAdmin(admin.modules.watchServer, { app })
    app.registerAdmin(require('../modules/console'), { app, starter })
    if (app.enabled('systemMonitor')) {
      if (os.platform() !== Constants.PLATFORM.WIN) {
        app.registerAdmin(admin.modules.systemInfo)
        app.registerAdmin(admin.modules.nodeInfo)
      }
      app.registerAdmin(admin.modules.monitorLog, { path: pathUtil.getLogPath(app.getBase()) })
      app.registerAdmin(admin.modules.scripts, { app, path: pathUtil.getScriptPath(app.getBase()) })
      if (os.platform() !== Constants.PLATFORM.WIN) {
        app.registerAdmin(admin.modules.profiler)
      }
    }
  }
}

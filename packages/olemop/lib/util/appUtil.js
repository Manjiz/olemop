const fs = require('fs')
const path = require('path')
const async = require('async')
const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
// @warn olemop 不能在这里引用
// const olemop = require('../olemop')
const starter = require('../master/starter')
const logUtil = require('./logUtil')
const utils = require('./utils')
const Constants = require('./constants')

/**
 * Initialize application configuration.
 */
exports.defaultConfiguration = (app) => {
  const args = _parseArgs(process.argv)
  _setupEnv(app, args)
  _loadMaster(app)
  _loadServers(app)
  _processArgs(app, args)
  configLogger(app)
  _loadLifecycle(app)
}

/**
 * Start servers by type.
 */
exports.startByType = (app, cb) => {
  if (app.startId) {
    if (app.startId === Constants.RESERVED.MASTER) {
      olemopUtils.invokeCallback(cb)
    } else {
      starter.runServers(app)
    }
  } else {
    if (app.type && app.type !== Constants.RESERVED.ALL && app.type !== Constants.RESERVED.MASTER) {
      starter.runServers(app)
    } else {
      olemopUtils.invokeCallback(cb)
    }
  }
}

/**
 * Load default components for application.
 */
exports.loadDefaultComponents = (app) => {
  const olemop = require('../olemop')
  // load system default components
  if (app.serverType === Constants.RESERVED.MASTER) {
    app.load(olemop.master, app.get('masterConfig'))
  } else {
    app.load(olemop.proxy, app.get('proxyConfig'))
    if (app.getCurServer().port) {
      app.load(olemop.remote, app.get('remoteConfig'))
    }
    if (app.isFrontend()) {
      app.load(olemop.connection, app.get('connectionConfig'))
      app.load(olemop.connector, app.get('connectorConfig'))
      app.load(olemop.session, app.get('sessionConfig'))
      // compatible for schedulerConfig
      if (app.get('schedulerConfig')) {
        app.load(olemop.pushScheduler, app.get('schedulerConfig'))
      } else {
        app.load(olemop.pushScheduler, app.get('pushSchedulerConfig'))
      }
    }
    app.load(olemop.backendSession, app.get('backendSessionConfig'))
    app.load(olemop.channel, app.get('channelConfig'))
    app.load(olemop.server, app.get('serverConfig'))
  }
  app.load(olemop.monitor, app.get('monitorConfig'))
}

/**
 * Stop components.
 *
 * @param  {Array}  comps component list
 * @param  {number}   index current component index
 * @param  {boolean}  force whether stop component immediately
 * @param  {Function} cb
 */
exports.stopComps = (comps, index, force, cb) => {
  if (index >= comps.length) {
    olemopUtils.invokeCallback(cb)
    return
  }
  const comp = comps[index]
  if (typeof comp.stop === 'function') {
    comp.stop(force, () => {
      // ignore any error
      exports.stopComps(comps, ++index, force, cb)
    })
  } else {
    exports.stopComps(comps, ++index, force, cb)
  }
}

/**
 * Apply command to loaded components.
 * This method would invoke the component {method} in series.
 * Any component {method} return err, it would return err directly.
 *
 * @param {Array} comps loaded component list
 * @param {string} method component lifecycle method name, such as: start, stop
 * @param {Function} cb
 */
exports.optComponents = (comps, method, cb) => {
  async.eachSeries(comps, (comp, done) => {
    if (typeof comp[method] === 'function') {
      comp[method](done)
    } else {
      done()
    }
  }, (err) => {
    if (err) {
      if (typeof err === 'string') {
        logger.error('fail to operate component, method: %s, err: %j', method, err)
      } else {
        logger.error('fail to operate component, method: %s, err: %j',  method, err.stack)
      }
    }
    olemopUtils.invokeCallback(cb, err)
  })
}

/**
 * Setup enviroment.
 */
const _setupEnv = (app, args) => {
  app.set(Constants.RESERVED.ENV, args.env || process.env.NODE_ENV || Constants.RESERVED.ENV_DEV, true)
}

/**
 * Load master info from config/master.json.
 */
const _loadMaster = (app) => {
  app.loadConfigBaseApp(Constants.RESERVED.MASTER, Constants.FILEPATH.MASTER)
  app.master = app.get(Constants.RESERVED.MASTER)
}

/**
 * Load server info from config/servers.json.
 */
const _loadServers = (app) => {
  app.loadConfigBaseApp(Constants.RESERVED.SERVERS, Constants.FILEPATH.SERVER)
  const servers = app.get(Constants.RESERVED.SERVERS)
  const serverMap = {}
  for (let serverType in servers) {
    const slist = servers[serverType]
    for (let i = 0; i < slist.length; i++) {
      const server = slist[i]
      server.serverType = serverType
      if (server[Constants.RESERVED.CLUSTER_COUNT]) {
        utils.loadCluster(app, server, serverMap)
        continue
      }
      serverMap[server.id] = server
      if (server.wsPort) {
        logger.warn('wsPort is deprecated, use clientPort in frontend server instead, server: %j', server)
      }
    }
  }
  app.set(Constants.KEYWORDS.SERVER_MAP, serverMap)
}

/**
 * Process server start command
 */
const _processArgs = (app, args) => {
  const serverType = args.serverType || Constants.RESERVED.MASTER
  const serverId = args.id || app.getMaster().id
  const mode = args.mode || Constants.RESERVED.CLUSTER
  const masterha = args.masterha || 'false'
  const type = args.type || Constants.RESERVED.ALL
  const startId = args.startId

  app.set(Constants.RESERVED.MAIN, args.main, true)
  app.set(Constants.RESERVED.SERVER_TYPE, serverType, true)
  app.set(Constants.RESERVED.SERVER_ID, serverId, true)
  app.set(Constants.RESERVED.MODE, mode, true)
  app.set(Constants.RESERVED.TYPE, type, true)
  if (startId) {
    app.set(Constants.RESERVED.STARTID, startId, true)
  }

  if (masterha === 'true') {
    app.master = args
    app.set(Constants.RESERVED.CURRENT_SERVER, args, true)
  } else if (serverType !== Constants.RESERVED.MASTER) {
    app.set(Constants.RESERVED.CURRENT_SERVER, args, true)
  } else {
    app.set(Constants.RESERVED.CURRENT_SERVER, app.getMaster(), true)
  }
}

/**
 * Configure custom logger.
 */
const configLogger = (app, logger) => {
  if (process.env.OLEMOP_LOGGER === 'off') return
  const env = app.get(Constants.RESERVED.ENV)
  const originPath = path.join(app.getBase(), Constants.FILEPATH.LOG)
  const presentPath = path.join(app.getBase(), Constants.FILEPATH.CONFIG_DIR, env, path.basename(Constants.FILEPATH.LOG))
  const present2Path = path.join(app.getBase(), Constants.FILEPATH.CONFIG_DIR, `${path.basename(Constants.FILEPATH.LOG, '.json')}.${env}.json`)
  if (fs.existsSync(originPath)) {
    logUtil.configure(app, originPath, logger)
  } else if (fs.existsSync(presentPath)) {
    logUtil.configure(app, presentPath, logger)
  } else if (fs.existsSync(present2Path)) {
    logUtil.configure(app, present2Path, logger)
  } else {
    logger.error('logger file path configuration is error.')
  }
}

exports.configLogger = configLogger

/**
 * Load lifecycle file.
 */
const _loadLifecycle = (app) => {
  const filePath = path.join(app.getBase(), Constants.FILEPATH.SERVER_DIR, app.serverType, Constants.FILEPATH.LIFECYCLE)
  if (!fs.existsSync(filePath)) return
  const lifecycle = require(filePath)
  for (let key in lifecycle) {
    if (typeof lifecycle[key] === 'function') {
      app.lifecycleCbs[key] = lifecycle[key]
    } else {
      logger.warn(`lifecycle.js in ${filePath} is error format.`)
    }
  }
}

/**
 * Parse command line arguments.
 *
 * @param args command line arguments
 *
 * @returns Object argsMap map of arguments
 */
const _parseArgs = (args) => {
  const argsMap = {}
  let mainPos = 1

  while (args[mainPos].indexOf('--') > 0) {
    mainPos++
  }
  argsMap.main = args[mainPos]

  for (let i = mainPos + 1; i < args.length; i++) {
    const arg = args[i]
    const sep = arg.indexOf('=')
    const key = arg.slice(0, sep)
    let value = arg.slice(sep + 1)
    if (!isNaN(Number(value)) && (value.indexOf('.') < 0)) {
      value = Number(value)
    }
    argsMap[key] = value
  }

  return argsMap
}

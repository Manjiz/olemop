/*!
 * Olemop -- proto
 * Copyright(c) 2012 xiechengchao <xiecc@163.com>
 * MIT Licensed
 */

const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')
const olemopUtils = require('@olemop/utils')
const logger = require('@olemop/logger').getLogger('olemop', __filename)
const events = require('./util/events')
const appUtil = require('./util/appUtil')
const Constants = require('./util/constants')
const appManager = require('./common/manager/appManager')

/**
 * Application prototype.
 *
 * @module
 */
var Application = module.exports = {}

/**
 * Application states
 */
// app has inited
var STATE_INITED  = 1
// app start
var STATE_START = 2
// app has started
var STATE_STARTED = 3
// app has stoped
var STATE_STOPED  = 4

/**
 * Initialize the server.
 *
 *   - setup default configuration
 */
Application.init = function (opts = {}) {
  // loaded component list
  this.loaded = []
  // name -> component map
  this.components = {}
  // collection keep set/get
  this.settings = {}
  var base = opts.base || path.dirname(require.main.filename)
  this.set(Constants.RESERVED.BASE, base, true)
  // event object to sub/pub events
  this.event = new EventEmitter()

  // current server info
  // current server id
  this.serverId = null
  // current server type
  this.serverType = null
  // current server info
  this.curServer = null
  // current server start time
  this.startTime = null

  // global server infos
  // master server info
  this.master = null
  // current global server info maps, id -> info
  this.servers = {}
  // current global type maps, type -> [info]
  this.serverTypeMaps = {}
  // current global server type list
  this.serverTypes = []
  // current server custom lifecycle callbacks
  this.lifecycleCbs = {}
  // cluster id seqence
  this.clusterSeq = {}

  appUtil.defaultConfiguration(this)

  this.state = STATE_INITED
  logger.info('application inited: %j', this.getServerId())
}

/**
 * Get application base path
 *
 *  // cwd: /home/game/
 *  olemop start
 *  // app.getBase() -> /home/game
 *
 * @returns {string} application base path
 *
 * @memberOf Application
 */
Application.getBase = function () {
  return this.get(Constants.RESERVED.BASE)
}

/**
 * Override require method in application
 *
 * @param {string} relative path of file
 *
 * @memberOf Application
 */
Application.require = function (ph) {
  return require(path.join(Application.getBase(), ph))
}

/**
 * Configure logger with {$base}/config/log4js.json
 *
 * @param {Object} logger @olemop/logger instance without configuration
 *
 * @memberOf Application
 */
Application.configureLogger = (logger) => {
  appUtil.configLogger(this, logger)
}

/**
 * add a filter to before and after filter
 *
 * @param {Object} filter provide before and after filter method.
 *                        A filter should have two methods: before and after.
 * @memberOf Application
 */
Application.filter = function (filter) {
  this.before(filter)
  this.after(filter)
}

/**
 * Add before filter.
 *
 * @param {Object|Function} bf before fileter, bf(msg, session, next)
 * @memberOf Application
 */
Application.before = function (bf) {
  addFilter(this, Constants.KEYWORDS.BEFORE_FILTER, bf)
}

/**
 * Add after filter.
 *
 * @param {Object|Function} af after filter, `af(err, msg, session, resp, next)`
 * @memberOf Application
 */
Application.after = function (af) {
  addFilter(this, Constants.KEYWORDS.AFTER_FILTER, af)
}

/**
 * add a global filter to before and after global filter
 *
 * @param {Object} filter provide before and after filter method.
 *                        A filter should have two methods: before and after.
 * @memberOf Application
 */
Application.globalFilter = function (filter) {
  this.globalBefore(filter)
  this.globalAfter(filter)
}

/**
 * Add global before filter.
 *
 * @param {Object|Function} bf before fileter, bf(msg, session, next)
 * @memberOf Application
 */
Application.globalBefore = function (bf) {
  addFilter(this, Constants.KEYWORDS.GLOBAL_BEFORE_FILTER, bf)
}

/**
 * Add global after filter.
 *
 * @param {Object|Function} af after filter, `af(err, msg, session, resp, next)`
 * @memberOf Application
 */
Application.globalAfter = function (af) {
  addFilter(this, Constants.KEYWORDS.GLOBAL_AFTER_FILTER, af)
}

/**
 * Add rpc before filter.
 *
 * @param {Object|Function} bf before fileter, bf(serverId, msg, opts, next)
 * @memberOf Application
 */
Application.rpcBefore = function (bf) {
  addFilter(this, Constants.KEYWORDS.RPC_BEFORE_FILTER, bf)
}

/**
 * Add rpc after filter.
 *
 * @param {Object|Function} af after filter, `af(serverId, msg, opts, next)`
 * @memberOf Application
 */
Application.rpcAfter = function (af) {
  addFilter(this, Constants.KEYWORDS.RPC_AFTER_FILTER, af)
}

/**
 * add a rpc filter to before and after rpc filter
 *
 * @param {Object} filter provide before and after filter method.
 *                        A filter should have two methods: before and after.
 * @memberOf Application
 */
Application.rpcFilter = function (filter) {
  this.rpcBefore(filter)
  this.rpcAfter(filter)
}

/**
 * Load component
 *
 * @param {string} name    (optional) name of the component
 * @param  {Object} component component instance or factory function of the component
 * @param  {[type]} opts    (optional) construct parameters for the factory function
 * @returns {Object}     app instance for chain invoke
 * @memberOf Application
 */
Application.load = function (name, component, opts) {
  if (typeof name !== 'string') {
    opts = component
    component = name
    name = null
    if (typeof component.name === 'string') {
      name = component.name
    }
  }

  if (typeof component === 'function') {
    component = component(this, opts)
  }

  if (!name && typeof component.name === 'string') {
    name = component.name
  }

  if (name && this.components[name]) {
    // ignore duplicat component
    logger.warn('ignore duplicate component: %j', name)
    return
  }

  this.loaded.push(component)
  if (name) {
    // components with a name would get by name throught app.components later.
    this.components[name] = component
  }

  return this
}

/**
 * Load Configure json file to settings.(support different enviroment directory & compatible for old path)
 *
 * @param {string} key environment key
 * @param {string} val environment value
 * @param {Boolean} reload whether reload after change default false
 * @returns {Server|Mixed} for chaining, or the setting value
 * @memberOf Application
 */
Application.loadConfigBaseApp = function (key, val, reload) {
  var self = this
  var env = this.get(Constants.RESERVED.ENV)
  var originPath = path.join(Application.getBase(), val)
  var presentPath = path.join(Application.getBase(), Constants.FILEPATH.CONFIG_DIR, env, path.basename(val))
  var realPath
  if (fs.existsSync(originPath)) {
     realPath = originPath
     var file = require(originPath)
     if (file[env]) {
       file = file[env]
     }
     this.set(key, file)
  } else if (fs.existsSync(presentPath)) {
    realPath = presentPath
    var pfile = require(presentPath)
    this.set(key, pfile)
  } else {
    logger.error('invalid configuration with file path: %s', key)
  }

  if (realPath && reload) {
    fs.watch(realPath, function (event, filename) {
      if (event === 'change') {
        delete require.cache[require.resolve(realPath)]
        self.loadConfigBaseApp(key, val)
      }
    })
  }
}

/**
 * Load Configure json file to settings.
 *
 * @param {string} key environment key
 * @param {string} val environment value
 * @returns {Server|Mixed} for chaining, or the setting value
 * @memberOf Application
 */
Application.loadConfig = function (key, val) {
  var env = this.get(Constants.RESERVED.ENV)
  val = require(val)
  if (val[env]) {
    val = val[env]
  }
  this.set(key, val)
}

/**
 * Set the route function for the specified server type.
 *
 * Examples:
 *
 *  app.route('area', routeFunc)
 *
 *  var routeFunc = function (session, msg, app, cb) {
 *    // all request to area would be route to the first area server
 *    var areas = app.getServersByType('area')
 *    cb(null, areas[0].id)
 *  }
 *
 * @param {string} serverType server type string
 * @param  {Function} routeFunc  route function. routeFunc(session, msg, app, cb)
 * @returns {Object}     current application instance for chain invoking
 * @memberOf Application
 */
Application.route = function (serverType, routeFunc) {
  var routes = this.get(Constants.KEYWORDS.ROUTE)
  if (!routes) {
    routes = {}
    this.set(Constants.KEYWORDS.ROUTE, routes)
  }
  routes[serverType] = routeFunc
  return this
}

/**
 * Set before stop function. It would perform before servers stop.
 *
 * @param  {Function} fun before close function
 * @returns {Void}
 * @memberOf Application
 */
Application.beforeStopHook = function (fun) {
  logger.warn('this method was deprecated in olemop 0.8')
  if (fun && typeof fun === 'function') {
    this.set(Constants.KEYWORDS.BEFORE_STOP_HOOK, fun)
  }
}

/**
 * Start application. It would load the default components and start all the loaded components.
 *
 * @param  {Function} cb callback function
 * @memberOf Application
 */
 Application.start = function (cb) {
  this.startTime = Date.now()
  if (this.state > STATE_INITED) {
    olemopUtils.invokeCallback(cb, new Error('application has already start.'))
    return
  }

  var self = this
  appUtil.startByType(self, function () {
    appUtil.loadDefaultComponents(self)
    var startUp = function () {
      appUtil.optComponents(self.loaded, Constants.RESERVED.START, function (err) {
        self.state = STATE_START
        if (err) {
          olemopUtils.invokeCallback(cb, rr)
        } else {
          logger.info('%j enter after start...', self.getServerId())
          self.afterStart(cb)
        }
      })
    }
    var beforeFun = self.lifecycleCbs[Constants.LIFECYCLE.BEFORE_STARTUP]
    if (beforeFun) {
      beforeFun.call(null, self, startUp)
    } else {
      startUp()
    }
  })
}

/**
 * Lifecycle callback for after start.
 *
 * @param  {Function} cb callback function
 * @returns {Void}
 */
Application.afterStart = function (cb) {
  if (this.state !== STATE_START) {
    olemopUtils.invokeCallback(cb, new Error('application is not running now.'))
    return
  }

  var afterFun = this.lifecycleCbs[Constants.LIFECYCLE.AFTER_STARTUP]
  var self = this
  appUtil.optComponents(this.loaded, Constants.RESERVED.AFTER_START, function (err) {
    self.state = STATE_STARTED
    var id = self.getServerId()
    if (!err) {
      logger.info('%j finish start', id)
    }
    if (afterFun) {
      afterFun.call(null, self, function () {
        olemopUtils.invokeCallback(cb, err)
      })
    } else {
      olemopUtils.invokeCallback(cb, err)
    }
    var usedTime = Date.now() - self.startTime
    logger.info('%j startup in %s ms', id, usedTime)
    self.event.emit(events.START_SERVER, id)
  })
}

/**
 * Stop components.
 *
 * @param  {Boolean} force whether stop the app immediately
 */
Application.stop = function (force) {
  if (this.state > STATE_STARTED) {
    logger.warn('[olemop application] application is not running now.')
    return
  }
  this.state = STATE_STOPED
  var self = this

  this.stopTimer = setTimeout(function () {
    process.exit(0)
  }, Constants.TIME.TIME_WAIT_STOP)

  var cancelShutDownTimer =function () {
      if (self.stopTimer) {
        clearTimeout(self.stopTimer)
      }
  }
  var shutDown = function () {
    appUtil.stopComps(self.loaded, 0, force, function () {
      cancelShutDownTimer()
      if (force) {
        process.exit(0)
      }
    })
  }
  var fun = this.get(Constants.KEYWORDS.BEFORE_STOP_HOOK)
  var stopFun = this.lifecycleCbs[Constants.LIFECYCLE.BEFORE_SHUTDOWN]
  if (stopFun) {
    stopFun.call(null, this, shutDown, cancelShutDownTimer)
  } else if (fun) {
    olemopUtils.invokeCallback(fun, self, shutDown, cancelShutDownTimer)
  } else {
    shutDown()
  }
}

/**
 * Assign `setting` to `val`, or return `setting`'s value.
 *
 * Example:
 *
 *  app.set('key1', 'value1')
 *  // 'value1'
 *  app.get('key1')
 *  // undefined
 *  app.key1
 *
 *  app.set('key2', 'value2', true)
 *  // 'value2'
 *  app.get('key2')
 *  // 'value2'
 *  app.key2
 *
 * @param {string} setting the setting of application
 * @param {string} val the setting's value
 * @param {Boolean} attach whether attach the settings to application
 * @returns {Server|Mixed} for chaining, or the setting value
 * @memberOf Application
 */
Application.set = function (setting, val, attach) {
  if (arguments.length === 1) {
    return this.settings[setting]
  }
  this.settings[setting] = val
  if (attach) {
    this[setting] = val
  }
  return this
}

/**
 * Get property from setting
 *
 * @param {string} setting application setting
 * @returns {string} val
 * @memberOf Application
 */
Application.get = function (setting) {
  return this.settings[setting]
}

/**
 * Check if `setting` is enabled.
 *
 * @param {string} setting application setting
 * @returns {Boolean}
 * @memberOf Application
 */
Application.enabled = function (setting) {
  return this.get(setting)
}

/**
 * Check if `setting` is disabled.
 *
 * @param {string} setting application setting
 * @returns {Boolean}
 * @memberOf Application
 */
Application.disabled = function (setting) {
  return !this.get(setting)
}

/**
 * Enable `setting`.
 *
 * @param {string} setting application setting
 * @returns {app} for chaining
 * @memberOf Application
 */
Application.enable = function (setting) {
  return this.set(setting, true)
}

/**
 * Disable `setting`.
 *
 * @param {string} setting application setting
 * @returns {app} for chaining
 * @memberOf Application
 */
Application.disable = function (setting) {
  return this.set(setting, false)
}

/**
 * Configure callback for the specified env and server type.
 * When no env is specified that callback will
 * be invoked for all environments and when no type is specified
 * that callback will be invoked for all server types.
 *
 * Examples:
 *
 *  app.configure(function () {
 *    // executed for all envs and server types
 *  })
 *
 *  app.configure('development', function () {
 *    // executed development env
 *  })
 *
 *  app.configure('development', 'connector', function () {
 *    // executed for development env and connector server type
 *  })
 *
 * @param {string} env application environment
 * @param {Function} fn callback function
 * @param {string} type server type
 * @returns {Application} for chaining
 * @memberOf Application
 */
Application.configure = function (env, type, fn) {
  var args = [].slice.call(arguments)
  fn = args.pop()
  env = type = Constants.RESERVED.ALL

  if (args.length > 0) {
    env = args[0]
  }
  if (args.length > 1) {
    type = args[1]
  }

  if (env === Constants.RESERVED.ALL || contains(this.settings.env, env)) {
    if (type === Constants.RESERVED.ALL || contains(this.settings.serverType, type)) {
      fn.call(this)
    }
  }
  return this
}

/**
 * Register admin modules. Admin modules is the extends point of the monitor system.
 *
 * @param {string} moduleId (optional) module id or provoided by module.moduleId
 * @param {Object} _module module object or factory function for module
 * @param {Object} opts construct parameter for module
 * @memberOf Application
 */
Application.registerAdmin = function (moduleId, _module, opts) {
  let modules = this.get(Constants.KEYWORDS.MODULE)
  if (!modules) {
    modules = {}
    this.set(Constants.KEYWORDS.MODULE, modules)
  }

  if (typeof moduleId !== 'string') {
    opts = _module
    _module = moduleId
    if (_module) {
      moduleId = _module.moduleId
    }
  }

  if (!moduleId) return

  modules[moduleId] = {
    moduleId,
    module: _module,
    opts
  }
}

/**
 * Use plugin.
 *
 * @param  {Object} plugin plugin instance
 * @param  {[type]} opts    (optional) construct parameters for the factory function
 * @memberOf Application
 */
Application.use = function (plugin, opts = {}) {
  if (!plugin.components) {
    logger.error('invalid components, no components exist')
    return
  }

  var self = this
  var dir = path.dirname(plugin.components)

  if (!fs.existsSync(plugin.components)) {
    logger.error('fail to find components, find path: %s', plugin.components)
    return
  }

  fs.readdirSync(plugin.components).forEach(function (filename) {
    if (!/\.js$/.test(filename)) {
      return
    }
    var name = path.basename(filename, '.js')
    var param = opts[name] || {}
    var absolutePath = path.join(dir, Constants.DIR.COMPONENT, filename)
    if (!fs.existsSync(absolutePath)) {
      logger.error('component %s not exist at %s', name, absolutePath)
    } else {
      self.load(require(absolutePath), param)
    }
  })

  // load events
  if (!plugin.events) return
  if (!fs.existsSync(plugin.events)) {
    logger.error(`fail to find events, find path: ${plugin.events}`)
    return
  }

  fs.readdirSync(plugin.events).forEach((filename) => {
    if (!/\.js$/.test(filename)) return
    const absolutePath = path.join(dir, Constants.DIR.EVENT, filename)
    if (!fs.existsSync(absolutePath)) {
      logger.error(`events ${filename} not exist at ${absolutePath}`)
    } else {
      bindEvents(require(absolutePath), self)
    }
  })
}

/**
 * @see appManager.transaction
 */
Application.transaction = function (name, conditions, handlers, retry) {
  appManager.transaction(name, conditions, handlers, retry)
}

/**
 * Get master server info.
 *
 * @returns {Object} master server info, {id, host, port}
 * @memberOf Application
 */
Application.getMaster = function () {
  return this.master
}

/**
 * Get current server info.
 *
 * @returns {Object} current server info, {id, serverType, host, port}
 * @memberOf Application
 */
Application.getCurServer = function () {
  return this.curServer
}

/**
 * Get current server id.
 *
 * @returns {String|Number} current server id from servers.json
 * @memberOf Application
 */
Application.getServerId = function () {
  return this.serverId
}

/**
 * Get current server type.
 *
 * @returns {String|Number} current server type from servers.json
 * @memberOf Application
 */
Application.getServerType = function () {
  return this.serverType
}

/**
 * Get all the current server infos.
 *
 * @returns {Object} server info map, key: server id, value: server info
 * @memberOf Application
 */
Application.getServers = function () {
  return this.servers
}

/**
 * Get all server infos from servers.json.
 *
 * @returns {Object} server info map, key: server id, value: server info
 * @memberOf Application
 */
Application.getServersFromConfig = function () {
  return this.get(Constants.KEYWORDS.SERVER_MAP)
}

/**
 * Get all the server type.
 *
 * @returns {Array} server type list
 * @memberOf Application
 */
Application.getServerTypes = function () {
  return this.serverTypes
}

/**
 * Get server info by server id from current server cluster.
 *
 * @param {string} serverId server id
 * @returns {Object} server info or undefined
 * @memberOf Application
 */
Application.getServerById = function (serverId) {
  return this.servers[serverId]
}

/**
 * Get server info by server id from servers.json.
 *
 * @param {string} serverId server id
 * @returns {Object} server info or undefined
 * @memberOf Application
 */

Application.getServerFromConfig = function (serverId) {
  return this.get(Constants.KEYWORDS.SERVER_MAP)[serverId]
}

/**
 * Get server infos by server type.
 *
 * @param {string} serverType server type
 * @returns {Array}      server info list
 * @memberOf Application
 */
Application.getServersByType = function (serverType) {
  return this.serverTypeMaps[serverType]
}

/**
 * Check the server whether is a frontend server
 *
 * @param  {server}  server server info. it would check current server
 *            if server not specified
 * @returns {Boolean}
 *
 * @memberOf Application
 */
Application.isFrontend = function (server) {
  server = server || this.getCurServer()
  return server && server.frontend === 'true'
}

/**
 * Check the server whether is a backend server
 *
 * @param  {server}  server server info. it would check current server
 *            if server not specified
 * @returns {Boolean}
 * @memberOf Application
 */
Application.isBackend = function (server) {
  server = server || this.getCurServer()
  return server && !server.frontend
}

/**
 * Check whether current server is a master server
 *
 * @returns {Boolean}
 * @memberOf Application
 */
Application.isMaster = function () {
  return this.serverType === Constants.RESERVED.MASTER
}

/**
 * Add new server info to current application in runtime.
 *
 * @param {Array} servers new server info list
 * @memberOf Application
 */
Application.addServers = function (servers) {
  if (!servers || !servers.length) return

  for (let i = 0; i < servers.length; i++) {
    const item = servers[i]
    // update global server map
    this.servers[item.id] = item

    // update global server type map
    let slist = this.serverTypeMaps[item.serverType]
    if (!slist) {
      this.serverTypeMaps[item.serverType] = slist = []
    }
    replaceServer(slist, item)

    // update global server type list
    if (this.serverTypes.indexOf(item.serverType) < 0) {
      this.serverTypes.push(item.serverType)
    }
  }
  this.event.emit(events.ADD_SERVERS, servers)
}

/**
 * Remove server info from current application at runtime.
 *
 * @param  {Array} ids server id list
 * @memberOf Application
 */
Application.removeServers = function (ids) {
  if (!ids || !ids.length) return

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const item = this.servers[id]
    if (!item) continue
    // clean global server map
    delete this.servers[id]

    // clean global server type map
    const slist = this.serverTypeMaps[item.serverType]
    removeServer(slist, id)
    // TODO: should remove the server type if the slist is empty?
  }
  this.event.emit(events.REMOVE_SERVERS, ids)
}

/**
 * Replace server info from current application at runtime.
 *
 * @param  {Object} server id map
 * @memberOf Application
 */
Application.replaceServers = function (servers) {
  if (!servers) {
    return
  }

  this.servers = servers
  this.serverTypeMaps = {}
  this.serverTypes = []
  var serverArray = []
  for (var id in servers) {
    var server = servers[id]
    var serverType = server[Constants.RESERVED.SERVER_TYPE]
    var slist = this.serverTypeMaps[serverType]
    if (!slist) {
      this.serverTypeMaps[serverType] = slist = []
    }
    this.serverTypeMaps[serverType].push(server)
    // update global server type list
    if (this.serverTypes.indexOf(serverType) < 0) {
      this.serverTypes.push(serverType)
    }
    serverArray.push(server)
  }
  this.event.emit(events.REPLACE_SERVERS, serverArray)
}

/**
 * Add crons from current application at runtime.
 *
 * @param  {Array} crons new crons would be added in application
 * @memberOf Application
 */
Application.addCrons = function (crons) {
  if (!crons || !crons.length) {
    logger.warn('crons is not defined.')
    return
  }
  this.event.emit(events.ADD_CRONS, crons)
}

/**
 * Remove crons from current application at runtime.
 *
 * @param  {Array} crons old crons would be removed in application
 * @memberOf Application
 */
Application.removeCrons = function (crons) {
  if (!crons || !crons.length) {
    logger.warn('ids is not defined.')
    return
  }
  this.event.emit(events.REMOVE_CRONS, crons)
}

var replaceServer = function (slist, serverInfo) {
  for (var i=0, l=slist.length; i<l; i++) {
    if (slist[i].id === serverInfo.id) {
      slist[i] = serverInfo
      return
    }
  }
  slist.push(serverInfo)
}

var removeServer = function (slist, id) {
  if (!slist || !slist.length) {
    return
  }

  for (var i=0, l=slist.length; i<l; i++) {
    if (slist[i].id === id) {
      slist.splice(i, 1)
      return
    }
  }
}

var contains = function (str, settings) {
  if (!settings) {
    return false
  }

  var ts = settings.split("|")
  for (var i=0, l=ts.length; i<l; i++) {
    if (str === ts[i]) {
      return true
    }
  }
  return false
}

const bindEvents = (Event, app) => {
  const emethods = new Event(app)
  olemopUtils.listES6ClassMethods(emethods).forEach((m) => {
    app.event.on(m, emethods[m].bind(emethods))
  })
}

var addFilter = function (app, type, filter) {
 var filters = app.get(type)
  if (!filters) {
    filters = []
    app.set(type, filters)
  }
  filters.push(filter)
}

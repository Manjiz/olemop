/*!
 * Olemop -- proto
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
 */
const Application = module.exports = {}

/**
 * Application states
 */
// app has inited
const STATE_INITED  = 1
// app start
const STATE_START = 2
// app has started
const STATE_STARTED = 3
// app has stoped
const STATE_STOPED  = 4

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
  const base = opts.base || path.dirname(require.main.filename)
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
 */
Application.getBase = function () {
  return this.get(Constants.RESERVED.BASE)
}

/**
 * Override require method in application
 *
 * @param {string} relative path of file
 */
Application.require = function (ph) {
  return require(path.join(Application.getBase(), ph))
}

/**
 * Configure logger with {$base}/config/log4js.json
 *
 * @param {Object} logger @olemop/logger instance without configuration
 */
Application.configureLogger = function (logger) {
  appUtil.configLogger(this, logger)
}

/**
 * add a filter to before and after filter
 *
 * @param {Object} filter provide before and after filter method.
 *                        A filter should have two methods: before and after.
 */
Application.filter = function (filter) {
  this.before(filter)
  this.after(filter)
}

/**
 * Add before filter.
 *
 * @param {Object|Function} bf before fileter, bf(msg, session, next)
 */
Application.before = function (bf) {
  addFilter(this, Constants.KEYWORDS.BEFORE_FILTER, bf)
}

/**
 * Add after filter.
 *
 * @param {Object|Function} af after filter, `af(err, msg, session, resp, next)`
 */
Application.after = function (af) {
  addFilter(this, Constants.KEYWORDS.AFTER_FILTER, af)
}

/**
 * add a global filter to before and after global filter
 *
 * @param {Object} filter provide before and after filter method.
 *                        A filter should have two methods: before and after.
 */
Application.globalFilter = function (filter) {
  this.globalBefore(filter)
  this.globalAfter(filter)
}

/**
 * Add global before filter.
 *
 * @param {Object|Function} bf before fileter, bf(msg, session, next)
 */
Application.globalBefore = function (bf) {
  addFilter(this, Constants.KEYWORDS.GLOBAL_BEFORE_FILTER, bf)
}

/**
 * Add global after filter.
 *
 * @param {Object|Function} af after filter, `af(err, msg, session, resp, next)`
 */
Application.globalAfter = function (af) {
  addFilter(this, Constants.KEYWORDS.GLOBAL_AFTER_FILTER, af)
}

/**
 * Add rpc before filter.
 *
 * @param {Object|Function} bf before fileter, bf(serverId, msg, opts, next)
 */
Application.rpcBefore = function (bf) {
  addFilter(this, Constants.KEYWORDS.RPC_BEFORE_FILTER, bf)
}

/**
 * Add rpc after filter.
 *
 * @param {Object|Function} af after filter, `af(serverId, msg, opts, next)`
 */
Application.rpcAfter = function (af) {
  addFilter(this, Constants.KEYWORDS.RPC_AFTER_FILTER, af)
}

/**
 * add a rpc filter to before and after rpc filter
 *
 * @param {Object} filter provide before and after filter method.
 *                        A filter should have two methods: before and after.
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
 * @param {boolean} reload whether reload after change default false
 * @returns {Server|Mixed} for chaining, or the setting value
 */
Application.loadConfigBaseApp = function (key, val, reload) {
  const env = this.get(Constants.RESERVED.ENV)
  const originPath = path.join(Application.getBase(), val)
  const presentPath = path.join(Application.getBase(), Constants.FILEPATH.CONFIG_DIR, env, path.basename(val))
  let realPath
  if (fs.existsSync(originPath)) {
     realPath = originPath
     let file = require(originPath)
     if (file[env]) {
       file = file[env]
     }
     this.set(key, file)
  } else if (fs.existsSync(presentPath)) {
    realPath = presentPath
    const pfile = require(presentPath)
    this.set(key, pfile)
  } else {
    logger.error('invalid configuration with file path: %s', key)
  }

  if (realPath && reload) {
    fs.watch(realPath, (event, filename) => {
      if (event === 'change') {
        delete require.cache[require.resolve(realPath)]
        this.loadConfigBaseApp(key, val)
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
 */
Application.loadConfig = function (key, val) {
  const env = this.get(Constants.RESERVED.ENV)
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
 *  const routeFunc = function (session, msg, app, cb) {
 *    // all request to area would be route to the first area server
 *    const areas = app.getServersByType('area')
 *    cb(null, areas[0].id)
 *  }
 *
 * @param {string} serverType server type string
 * @param  {Function} routeFunc  route function. routeFunc(session, msg, app, cb)
 * @returns {Object}     current application instance for chain invoking
 */
Application.route = function (serverType, routeFunc) {
  let routes = this.get(Constants.KEYWORDS.ROUTE)
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
 */
 Application.start = function (cb) {
  this.startTime = Date.now()
  if (this.state > STATE_INITED) {
    olemopUtils.invokeCallback(cb, new Error('application has already start.'))
    return
  }

  appUtil.startByType(this, () => {
    appUtil.loadDefaultComponents(this)
    const startUp = () => {
      appUtil.optComponents(this.loaded, Constants.RESERVED.START, (err) => {
        this.state = STATE_START
        if (err) {
          olemopUtils.invokeCallback(cb, rr)
        } else {
          logger.info('%j enter after start...', this.getServerId())
          this.afterStart(cb)
        }
      })
    }
    const beforeFun = this.lifecycleCbs[Constants.LIFECYCLE.BEFORE_STARTUP]
    if (beforeFun) {
      beforeFun.call(null, this, startUp)
    } else {
      startUp()
    }
  })
}

/**
 * Lifecycle callback for after start.
 *
 * @param  {Function} cb callback function
 */
Application.afterStart = function (cb) {
  if (this.state !== STATE_START) {
    olemopUtils.invokeCallback(cb, new Error('application is not running now.'))
    return
  }

  const afterFun = this.lifecycleCbs[Constants.LIFECYCLE.AFTER_STARTUP]
  appUtil.optComponents(this.loaded, Constants.RESERVED.AFTER_START, (err) => {
    this.state = STATE_STARTED
    const id = this.getServerId()
    if (!err) {
      logger.info('%j finish start', id)
    }
    if (afterFun) {
      afterFun.call(null, this, () => {
        olemopUtils.invokeCallback(cb, err)
      })
    } else {
      olemopUtils.invokeCallback(cb, err)
    }
    logger.info('%j startup in %s ms', id, Date.now() - this.startTime)
    this.event.emit(events.START_SERVER, id)
  })
}

/**
 * Stop components.
 *
 * @param {boolean} force whether stop the app immediately
 */
Application.stop = function (force) {
  if (this.state > STATE_STARTED) {
    logger.warn('[olemop application] application is not running now.')
    return
  }
  this.state = STATE_STOPED

  this.stopTimer = setTimeout(() => {
    process.exit(0)
  }, Constants.TIME.TIME_WAIT_STOP)

  const cancelShutDownTimer = () => {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
    }
  }
  const shutDown = () => {
    appUtil.stopComps(this.loaded, 0, force, () => {
      cancelShutDownTimer()
      if (force) {
        process.exit(0)
      }
    })
  }
  const fun = this.get(Constants.KEYWORDS.BEFORE_STOP_HOOK)
  const stopFun = this.lifecycleCbs[Constants.LIFECYCLE.BEFORE_SHUTDOWN]
  if (stopFun) {
    stopFun.call(null, this, shutDown, cancelShutDownTimer)
  } else if (fun) {
    olemopUtils.invokeCallback(fun, this, shutDown, cancelShutDownTimer)
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
 * @param {boolean} attach whether attach the settings to application
 * @returns {Server|Mixed} for chaining, or the setting value
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
 */
Application.get = function (setting) {
  return this.settings[setting]
}

/**
 * Check if `setting` is enabled.
 *
 * @param {string} setting application setting
 * @returns {boolean}
 */
Application.enabled = function (setting) {
  return this.get(setting)
}

/**
 * Check if `setting` is disabled.
 *
 * @param {string} setting application setting
 * @returns {boolean}
 */
Application.disabled = function (setting) {
  return !this.get(setting)
}

/**
 * Enable `setting`.
 *
 * @param {string} setting application setting
 * @returns {app} for chaining
 */
Application.enable = function (setting) {
  return this.set(setting, true)
}

/**
 * Disable `setting`.
 *
 * @param {string} setting application setting
 * @returns {app} for chaining
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
 */
Application.configure = function (env, type, fn) {
  const args = [].slice.call(arguments)
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
 */
Application.use = function (plugin, opts = {}) {
  if (!plugin.components) {
    logger.error('invalid components, no components exist')
    return
  }

  const dir = path.dirname(plugin.components)

  if (!fs.existsSync(plugin.components)) {
    logger.error(`fail to find components, find path: ${plugin.components}`)
    return
  }

  fs.readdirSync(plugin.components).forEach((filename) => {
    if (!/\.js$/.test(filename)) return
    const name = path.basename(filename, '.js')
    const param = opts[name] || {}
    const absolutePath = path.join(dir, Constants.DIR.COMPONENT, filename)
    if (!fs.existsSync(absolutePath)) {
      logger.error(`component ${name} not exist at ${absolutePath}`)
    } else {
      this.load(require(absolutePath), param)
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
      bindEvents(require(absolutePath), this)
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
 */
Application.getMaster = function () {
  return this.master
}

/**
 * Get current server info.
 *
 * @returns {Object} current server info, {id, serverType, host, port}
 */
Application.getCurServer = function () {
  return this.curServer
}

/**
 * Get current server id.
 *
 * @returns {String|Number} current server id from servers.json
 */
Application.getServerId = function () {
  return this.serverId
}

/**
 * Get current server type.
 *
 * @returns {String|Number} current server type from servers.json
 */
Application.getServerType = function () {
  return this.serverType
}

/**
 * Get all the current server infos.
 *
 * @returns {Object} server info map, key: server id, value: server info
 */
Application.getServers = function () {
  return this.servers
}

/**
 * Get all server infos from servers.json.
 *
 * @returns {Object} server info map, key: server id, value: server info
 */
Application.getServersFromConfig = function () {
  return this.get(Constants.KEYWORDS.SERVER_MAP)
}

/**
 * Get all the server type.
 *
 * @returns {Array} server type list
 */
Application.getServerTypes = function () {
  return this.serverTypes
}

/**
 * Get server info by server id from current server cluster.
 *
 * @param {string} serverId server id
 * @returns {Object} server info or undefined
 */
Application.getServerById = function (serverId) {
  return this.servers[serverId]
}

/**
 * Get server info by server id from servers.json.
 *
 * @param {string} serverId server id
 * @returns {Object} server info or undefined
 */

Application.getServerFromConfig = function (serverId) {
  return this.get(Constants.KEYWORDS.SERVER_MAP)[serverId]
}

/**
 * Get server infos by server type.
 *
 * @param {string} serverType server type
 * @returns {Array}      server info list
 */
Application.getServersByType = function (serverType) {
  return this.serverTypeMaps[serverType]
}

/**
 * Check the server whether is a frontend server
 *
 * @param  {server}  server server info. it would check current server
 *            if server not specified
 * @returns {boolean}
 *
 */
Application.isFrontend = function (server = this.getCurServer()) {
  return server && server.frontend === 'true'
}

/**
 * Check the server whether is a backend server
 *
 * @param  {server}  server server info. it would check current server
 *            if server not specified
 * @returns {boolean}
 */
Application.isBackend = function (server = this.getCurServer()) {
  return server && !server.frontend
}

/**
 * Check whether current server is a master server
 *
 * @returns {boolean}
 */
Application.isMaster = function () {
  return this.serverType === Constants.RESERVED.MASTER
}

/**
 * Add new server info to current application in runtime.
 *
 * @param {Array} servers new server info list
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
    // @todo: should remove the server type if the slist is empty?
  }
  this.event.emit(events.REMOVE_SERVERS, ids)
}

/**
 * Replace server info from current application at runtime.
 *
 * @param  {Object} server id map
 */
Application.replaceServers = function (servers) {
  if (!servers) return
  this.servers = servers
  this.serverTypeMaps = {}
  this.serverTypes = []
  const serverArray = []
  for (let id in servers) {
    const server = servers[id]
    const serverType = server[Constants.RESERVED.SERVER_TYPE]
    let slist = this.serverTypeMaps[serverType]
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
 */
Application.removeCrons = function (crons) {
  if (!crons || !crons.length) {
    logger.warn('ids is not defined.')
    return
  }
  this.event.emit(events.REMOVE_CRONS, crons)
}

const replaceServer = (slist, serverInfo) => {
  for (let i = 0; i < slist.length; i++) {
    if (slist[i].id === serverInfo.id) {
      slist[i] = serverInfo
      return
    }
  }
  slist.push(serverInfo)
}

const removeServer = (slist, id) => {
  if (!slist || !slist.length) return

  for (let i = 0; i < slist.length; i++) {
    if (slist[i].id === id) {
      slist.splice(i, 1)
      return
    }
  }
}

const contains = (str, settings) => {
  if (!settings) return false

  const ts = settings.split('|')
  for (let i = 0; i < ts.length; i++) {
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

const addFilter = (app, type, filter) => {
 let filters = app.get(type)
  if (!filters) {
    filters = []
    app.set(type, filters)
  }
  filters.push(filter)
}
